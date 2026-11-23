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

        // Tanggal paling awal dan paling akhir data tersedia untuk kemudahan filter rentang tanggal
        $earliestOrderDate = Order::min('created_at');
        $earliestExpenseDate = AdminExpense::min('expense_date');
        $latestOrderDate = Order::max('created_at');
        $latestExpenseDate = AdminExpense::max('expense_date');

        $earliestDate = collect([$earliestOrderDate, $earliestExpenseDate])
            ->filter()
            ->map(fn($d) => \Carbon\Carbon::parse($d)->toDateString())
            ->min() ?: now('Asia/Jakarta')->toDateString();

        $latestDate = collect([$latestOrderDate, $latestExpenseDate])
            ->filter()
            ->map(fn($d) => \Carbon\Carbon::parse($d)->toDateString())
            ->max() ?: now('Asia/Jakarta')->toDateString();

        // 6. Rekap Pembagian Hasil / Gajian per Tanggal:
        // - Laba Toko dibagi: 70% Asrul, 15% Anma, 5% Qori, 10% Satpam
        // - Kurir (Kurir 1 Pak Faris, Kurir 2 Pak Feri, Total Ongkir)
        // - Kas Admin Higo setelah dikurangi pengeluaran kas Higo pada tanggal tersebut
        $expensesByDate = [];
        foreach ($allPeriodExpenses as $exp) {
            $dateKey = \Carbon\Carbon::parse($exp->expense_date)->toDateString();
            if (!isset($expensesByDate[$dateKey])) {
                $expensesByDate[$dateKey] = [
                    'total_amount' => 0,
                    'count' => 0,
                    'items' => [],
                ];
            }
            $expensesByDate[$dateKey]['total_amount'] += (float) $exp->amount;
            $expensesByDate[$dateKey]['count'] += 1;
            $expensesByDate[$dateKey]['items'][] = [
                'id' => $exp->id,
                'title' => $exp->title,
                'category' => $exp->category,
                'category_label' => $categoriesMeta[$exp->category] ?? $exp->category,
                'amount' => (float) $exp->amount,
                'recipient' => $exp->recipient,
                'notes' => $exp->notes,
                'payment_method' => $exp->payment_method,
            ];
        }

        $dailyRecapByDate = [];
        foreach (($recap['daily_recap'] ?? []) as $dItem) {
            $dailyRecapByDate[$dItem['date']] = $dItem;
        }

        $allPayrollDates = array_unique(array_merge(
            array_keys($dailyRecapByDate),
            array_keys($expensesByDate)
        ));
        rsort($allPayrollDates);

        $payrollDailyList = [];
        $payrollTotalProfit = 0;
        $payrollTotalAsrul = 0;
        $payrollTotalAnma = 0;
        $payrollTotalQori = 0;
        $payrollTotalSatpam = 0;
        $payrollTotalCourier1 = 0;
        $payrollTotalCourier2 = 0;
        $payrollTotalCouriers = 0;
        $payrollTotalAdminGross = 0;
        $payrollTotalAdminNet = 0;
        $payrollTotalExpenses = 0;
        $payrollTotalAdminBalance = 0;

        foreach ($allPayrollDates as $pDate) {
            $dItem = $dailyRecapByDate[$pDate] ?? null;
            $expData = $expensesByDate[$pDate] ?? ['total_amount' => 0, 'count' => 0, 'items' => []];

            $cDate = \Carbon\Carbon::parse($pDate, 'Asia/Jakarta');
            $cDate->locale('id');

            $orderCount = (int) ($dItem['order_count'] ?? 0);
            $totalProducts = (float) ($dItem['total_products'] ?? 0);
            $totalHpp = (float) ($dItem['total_hpp'] ?? 0);
            $totalProfit = (float) ($dItem['total_profit'] ?? 0); // Laba Toko

            // Pembagian Laba Toko: 70% Asrul, 15% Anma, 5% Qori, 10% Satpam
            $shareAsrul = round($totalProfit * 0.70);
            $shareAnma = round($totalProfit * 0.15);
            $shareQori = round($totalProfit * 0.05);
            $shareSatpam = round($totalProfit * 0.10);

            // Kurir
            $c1Data = $dItem['courier_1'] ?? [
                'courier_id' => 12,
                'courier_name' => 'Kurir pak faris',
                'order_count' => 0,
                'delivery_fee' => 0,
                'courier_cut_to_admin' => 0,
                'gross_delivery_fee' => 0,
                'grand_total' => 0,
            ];
            $c2Data = $dItem['courier_2'] ?? [
                'courier_id' => 794,
                'courier_name' => 'kurir pak feri',
                'order_count' => 0,
                'delivery_fee' => 0,
                'courier_cut_to_admin' => 0,
                'gross_delivery_fee' => 0,
                'grand_total' => 0,
            ];
            $c1Fee = (float) ($c1Data['delivery_fee'] ?? 0);
            $c2Fee = (float) ($c2Data['delivery_fee'] ?? 0);
            $dayTotalDeliveryFee = (float) ($dItem['total_delivery_fee'] ?? 0);

            // Admin Higo
            $adminGrossFee = (float) ($dItem['total_admin_fee'] ?? 0);
            $adminVoucher = (float) ($dItem['total_voucher_discount'] ?? 0);
            $adminNetIncome = (float) ($dItem['net_admin_fee'] ?? max(0, $adminGrossFee - $adminVoucher));
            $dayExpenses = (float) ($expData['total_amount'] ?? 0);
            $adminNetBalance = $adminNetIncome - $dayExpenses; // Laba admin setelah pengeluaran higo

            // Akumulasi periode
            $payrollTotalProfit += $totalProfit;
            $payrollTotalAsrul += $shareAsrul;
            $payrollTotalAnma += $shareAnma;
            $payrollTotalQori += $shareQori;
            $payrollTotalSatpam += $shareSatpam;
            $payrollTotalCourier1 += $c1Fee;
            $payrollTotalCourier2 += $c2Fee;
            $payrollTotalCouriers += $dayTotalDeliveryFee;
            $payrollTotalAdminGross += $adminGrossFee;
            $payrollTotalAdminNet += $adminNetIncome;
            $payrollTotalExpenses += $dayExpenses;
            $payrollTotalAdminBalance += $adminNetBalance;

            $payrollDailyList[] = [
                'date' => $pDate,
                'date_formatted' => $cDate->translatedFormat('d M Y'),
                'day_name' => $cDate->translatedFormat('l'),
                'order_count' => $orderCount,
                'total_products' => $totalProducts,
                'total_hpp' => $totalHpp,
                'total_profit' => $totalProfit,
                'sharing' => [
                    'asrul' => [
                        'name' => 'Asrul',
                        'percentage' => 70,
                        'amount' => $shareAsrul,
                    ],
                    'anma' => [
                        'name' => 'Anma',
                        'percentage' => 15,
                        'amount' => $shareAnma,
                    ],
                    'qori' => [
                        'name' => 'Qori',
                        'percentage' => 5,
                        'amount' => $shareQori,
                    ],
                    'satpam' => [
                        'name' => 'Satpam',
                        'percentage' => 10,
                        'amount' => $shareSatpam,
                    ],
                ],
                'courier' => [
                    'courier_1' => $c1Data,
                    'courier_2' => $c2Data,
                    'total_delivery_fee' => $dayTotalDeliveryFee,
                    'couriers_list' => $dItem['couriers'] ?? [],
                ],
                'admin' => [
                    'gross_admin_fee' => $adminGrossFee,
                    'net_admin_income' => $adminNetIncome,
                    'expenses_amount' => $dayExpenses,
                    'expenses_count' => $expData['count'] ?? 0,
                    'expenses_items' => $expData['items'] ?? [],
                    'net_balance' => $adminNetBalance,
                ],
                'canteens' => $dItem['canteens'] ?? [],
            ];
        }

        $payrollRecap = [
            'summary' => [
                'total_profit' => $payrollTotalProfit,
                'total_asrul' => $payrollTotalAsrul,
                'total_anma' => $payrollTotalAnma,
                'total_qori' => $payrollTotalQori,
                'total_satpam' => $payrollTotalSatpam,
                'total_courier_1' => $payrollTotalCourier1,
                'total_courier_2' => $payrollTotalCourier2,
                'total_couriers' => $payrollTotalCouriers,
                'total_admin_gross' => $payrollTotalAdminGross,
                'total_admin_net' => $payrollTotalAdminNet,
                'total_expenses' => $payrollTotalExpenses,
                'total_admin_balance' => $payrollTotalAdminBalance,
            ],
            'daily_list' => $payrollDailyList,
        ];

        return response()->json([
            'period' => $period,
            'date_bounds' => [
                'earliest_date' => $earliestDate,
                'latest_date' => $latestDate,
            ],
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
            'daily_recap' => $recap['daily_recap'] ?? [],
            'payroll_recap' => $payrollRecap,
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

