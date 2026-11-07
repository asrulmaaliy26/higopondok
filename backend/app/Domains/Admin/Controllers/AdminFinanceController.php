<?php

namespace App\Domains\Admin\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Admin\AdminExpense;
use App\Domains\Admin\ActivityLog;
use App\Domains\Admin\Requests\StoreAdminExpenseRequest;
use App\Domains\Admin\Requests\UpdateAdminExpenseRequest;
use App\Domains\Admin\Resources\AdminExpenseResource;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Canteen;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AdminFinanceController extends Controller
{
    /**
     * Get comprehensive financial recap (Laba, Biaya Admin, Ongkir, & Pengeluaran Kas Higo)
     */
    public function summary(Request $request)
    {
        $period = $request->query('period', 'month');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $canteenId = $request->query('canteen_id', 'all');
        $courierId = $request->query('courier_id', 'all');
        $expenseCategory = $request->query('expense_category', 'all');
        $search = trim((string) $request->query('search', ''));

        // 1. Query Pesanan untuk Rekap Pendapatan (Laba Toko, Biaya Admin, Ongkir)
        $ordersQuery = Order::forRecap()->filterPeriod($period, $startDate, $endDate);

        if ($canteenId && $canteenId !== 'all') {
            $ordersQuery->where('canteen_id', $canteenId);
        }

        if ($courierId && $courierId !== 'all') {
            if ($courierId === 'none' || $courierId === 'unassigned') {
                $ordersQuery->whereNull('courier_id');
            } else {
                $ordersQuery->where('courier_id', $courierId);
            }
        }

        $orders = $ordersQuery->orderBy('created_at', 'asc')->orderBy('id', 'asc')->get();
        $recap = Order::calculateRecap($orders, $period);
        $recapSummary = $recap['summary'] ?? [];

        // 2. Query Pengeluaran Kas Higo pada Periode yang Sama
        $expensesBaseQuery = AdminExpense::with('admin:id,name')
            ->filterPeriod($period, $startDate, $endDate);

        // Hitung breakdown pengeluaran per kategori di periode ini (sebelum difilter kategori spesifik)
        $allPeriodExpenses = (clone $expensesBaseQuery)->orderByDesc('expense_date')->orderByDesc('id')->get();
        $totalExpenses = (float) $allPeriodExpenses->sum('amount');
        $expensesCount = $allPeriodExpenses->count();

        $categoriesMeta = AdminExpense::getCategories();
        $expenseCategoryBreakdown = [];
        foreach ($categoriesMeta as $catKey => $catLabel) {
            $catItems = $allPeriodExpenses->where('category', $catKey);
            $catSum = (float) $catItems->sum('amount');
            $catCount = $catItems->count();
            if ($catCount > 0 || in_array($catKey, ['operasional', 'server_it', 'insentif_kurir', 'perlengkapan', 'promosi_marketing', 'sosial_pondok', 'lainnya'])) {
                $expenseCategoryBreakdown[] = [
                    'category' => $catKey,
                    'label' => $catLabel,
                    'count' => $catCount,
                    'total_amount' => $catSum,
                    'percentage' => $totalExpenses > 0 ? round(($catSum / $totalExpenses) * 100, 1) : 0,
                ];
            }
        }
        usort($expenseCategoryBreakdown, fn($a, $b) => $b['total_amount'] <=> $a['total_amount']);

        // 3. Filter Daftar Pengeluaran sesuai kategori & pencarian dari user
        $filteredExpensesQuery = clone $expensesBaseQuery;
        if ($expenseCategory && $expenseCategory !== 'all') {
            $filteredExpensesQuery->where('category', $expenseCategory);
        }
        if ($search !== '') {
            $filteredExpensesQuery->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('recipient', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $expensesList = $filteredExpensesQuery
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get();

        // 4. Kalkulasi Kas & Laba Bersih Higo
        // - total_admin_fee: Total Biaya Admin Kotor (Pokok + Pindahan Ongkir Kurir)
        // - total_base_admin_fee: Biaya Admin Pokok murni
        // - total_courier_cut_to_admin: Pindahan Ongkir Kurir yang masuk ke Kas Admin
        // - total_voucher_discount: Subsidi Diskon Voucher yang ditanggung Kas Admin
        // - net_admin_fee: Kas Admin Bersih setelah dikurangi voucher (Pendapatan Bersih Higo dari transaksi)
        $grossAdminIncome = (float) ($recapSummary['total_admin_fee'] ?? 0);
        $baseAdminFee = (float) ($recapSummary['total_base_admin_fee'] ?? 0);
        $courierCutToAdmin = (float) ($recapSummary['total_courier_cut_to_admin'] ?? 0);
        $voucherSubsidy = (float) ($recapSummary['total_voucher_discount'] ?? 0);
        $netAdminIncome = (float) ($recapSummary['net_admin_fee'] ?? max(0, $grossAdminIncome - $voucherSubsidy));

        $courierNetDeliveryFee = (float) ($recapSummary['total_courier_net_delivery_fee'] ?? $recapSummary['total_delivery_fee'] ?? 0);
        $grossDeliveryFee = $courierNetDeliveryFee + $courierCutToAdmin;

        $totalProductsOmzet = (float) ($recapSummary['total_products'] ?? 0);
        $totalHpp = (float) ($recapSummary['total_hpp'] ?? 0);
        $totalCanteenProfit = (float) ($recapSummary['total_profit'] ?? ($totalProductsOmzet - $totalHpp));
        $grandTotalTransactions = (float) ($recapSummary['grand_total'] ?? 0);

        // Saldo Kas Bersih Higo = Pendapatan Kas Admin Bersih - Total Pengeluaran Kas Higo
        $netHigoCashBalance = $netAdminIncome - $totalExpenses;

        // 5. Statistik Sepanjang Waktu (All-Time Kas Higo) sebagai referensi saldo buku besar
        $allTimeAdminFee = (float) Order::whereIn('status', ['processing', 'completed'])->sum('admin_fee');
        $allTimeVoucherDiscount = (float) Order::whereIn('status', ['processing', 'completed'])->sum('voucher_discount');
        $allTimeNetAdminIncome = max(0, $allTimeAdminFee - $allTimeVoucherDiscount);
        $allTimeExpenses = (float) AdminExpense::sum('amount');
        $allTimeCashBalance = $allTimeNetAdminIncome - $allTimeExpenses;

        return response()->json([
            'period' => $period,
            'financial_summary' => [
                'total_orders' => (int) ($recapSummary['total_orders'] ?? 0),
                'grand_total_transactions' => $grandTotalTransactions,

                // Rekap Toko (Omzet, HPP, Laba Toko)
                'total_products_omzet' => $totalProductsOmzet,
                'total_hpp' => $totalHpp,
                'total_canteen_profit' => $totalCanteenProfit,

                // Rekap Ongkir (Kotor, Bersih Kurir, Pindahan ke Admin)
                'gross_delivery_fee' => $grossDeliveryFee,
                'courier_net_delivery_fee' => $courierNetDeliveryFee,
                'courier_cut_to_admin' => $courierCutToAdmin,

                // Rekap Biaya Admin / Laba Higo
                'base_admin_fee' => $baseAdminFee,
                'gross_admin_income' => $grossAdminIncome,
                'voucher_subsidy' => $voucherSubsidy,
                'net_admin_income' => $netAdminIncome,

                // Rekap Pengeluaran Kas Higo & Saldo Akhir Periode
                'total_expenses' => $totalExpenses,
                'expenses_count' => $expensesCount,
                'net_higo_cash_balance' => $netHigoCashBalance,

                // All-Time Kas Higo
                'all_time_net_admin_income' => $allTimeNetAdminIncome,
                'all_time_expenses' => $allTimeExpenses,
                'all_time_cash_balance' => $allTimeCashBalance,
            ],
            'canteen_recap' => $recap['canteen_recap'] ?? [],
            'courier_recap' => $recap['courier_recap'] ?? [],
            'expense_categories' => $categoriesMeta,
            'expense_category_breakdown' => $expenseCategoryBreakdown,
            'expenses' => AdminExpenseResource::collection($expensesList),
        ]);
    }

    /**
     * Store a new Admin Expense (Pengeluaran Kas Higo)
     */
    public function store(StoreAdminExpenseRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $data = $request->validated();
            $user = $request->user();

            $proofPath = null;
            if ($request->hasFile('proof_image')) {
                $proofPath = $this->storeOptimizedImage(
                    $request->file('proof_image'),
                    $user,
                    'pengeluaran_kas'
                );
            }

            $expense = AdminExpense::create([
                'admin_id' => $user->id,
                'expense_date' => $data['expense_date'],
                'title' => $data['title'],
                'category' => $data['category'],
                'amount' => (float) $data['amount'],
                'payment_method' => $data['payment_method'] ?? 'cash',
                'recipient' => $data['recipient'] ?? null,
                'notes' => $data['notes'] ?? null,
                'proof_image' => $proofPath,
            ]);

            $expense->load('admin:id,name');

            $formattedAmount = number_format($expense->amount, 0, ',', '.');
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'created',
                'model_type' => AdminExpense::class,
                'model_id' => $expense->id,
                'description' => "Mencatat pengeluaran kas Higo '{$expense->title}' sebesar Rp {$formattedAmount} (Kategori: {$expense->category})",
            ]);

            return response()->json([
                'message' => 'Pengeluaran kas Higo berhasil dicatat.',
                'expense' => new AdminExpenseResource($expense),
            ], 201);
        });
    }

    /**
     * Update an existing Admin Expense
     */
    public function update(UpdateAdminExpenseRequest $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $expense = AdminExpense::findOrFail($id);
            $data = $request->validated();
            $user = $request->user();

            if ($request->boolean('remove_proof') && $expense->proof_image) {
                $this->deleteOldProofFile($expense->proof_image);
                $expense->proof_image = null;
            }

            if ($request->hasFile('proof_image')) {
                if ($expense->proof_image) {
                    $this->deleteOldProofFile($expense->proof_image);
                }
                $expense->proof_image = $this->storeOptimizedImage(
                    $request->file('proof_image'),
                    $user,
                    'pengeluaran_kas'
                );
            }

            if (isset($data['expense_date'])) $expense->expense_date = $data['expense_date'];
            if (isset($data['title'])) $expense->title = $data['title'];
            if (isset($data['category'])) $expense->category = $data['category'];
            if (isset($data['amount'])) $expense->amount = (float) $data['amount'];
            if (array_key_exists('payment_method', $data)) $expense->payment_method = $data['payment_method'] ?: 'cash';
            if (array_key_exists('recipient', $data)) $expense->recipient = $data['recipient'];
            if (array_key_exists('notes', $data)) $expense->notes = $data['notes'];

            $expense->save();
            $expense->load('admin:id,name');

            $formattedAmount = number_format($expense->amount, 0, ',', '.');
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'updated',
                'model_type' => AdminExpense::class,
                'model_id' => $expense->id,
                'description' => "Memperbarui pengeluaran kas Higo '{$expense->title}' menjadi Rp {$formattedAmount}",
            ]);

            return response()->json([
                'message' => 'Data pengeluaran kas Higo berhasil diperbarui.',
                'expense' => new AdminExpenseResource($expense),
            ]);
        });
    }

    /**
     * Delete an Admin Expense
     */
    public function destroy(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $expense = AdminExpense::findOrFail($id);
            $user = $request->user();

            $title = $expense->title;
            $formattedAmount = number_format($expense->amount, 0, ',', '.');

            if ($expense->proof_image) {
                $this->deleteOldProofFile($expense->proof_image);
            }

            $expense->delete();

            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'deleted',
                'model_type' => AdminExpense::class,
                'model_id' => $id,
                'description' => "Menghapus catatan pengeluaran kas Higo '{$title}' (Rp {$formattedAmount})",
            ]);

            return response()->json([
                'message' => 'Catatan pengeluaran kas Higo berhasil dihapus.',
            ]);
        });
    }

    protected function deleteOldProofFile(?string $path): void
    {
        if (!$path || str_starts_with($path, 'http')) {
            return;
        }
        $cleanPath = ltrim(str_replace(['/storage/', 'storage/'], '', $path), '/');
        try {
            if (Storage::disk('public')->exists($cleanPath)) {
                Storage::disk('public')->delete($cleanPath);
            }
        } catch (\Throwable $e) {
            // Ignore cleanup failure
        }
    }
}

