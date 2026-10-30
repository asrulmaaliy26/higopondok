<?php

namespace App\Domains\Admin\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Domains\Canteen\Order;
use App\Domains\Admin\ActivityLog;
use App\Domains\Admin\Requests\AdminUploadPaymentProofRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class AdminOrderController extends Controller
{
    /**
     * Get all orders with filtering and search
     */
    public function index(Request $request)
    {
        $query = Order::with(['user', 'canteen.couriers:users.id,users.name', 'canteen', 'courier', 'items.product'])
            ->orderBy('is_priority', 'desc')
            ->orderBy('created_at', 'desc');

        // Filter by Canteen / Toko
        $canteenId = $request->query('canteen_id');
        if ($canteenId && $canteenId !== 'all') {
            $query->where('canteen_id', $canteenId);
        }

        // Filter by Courier / Kurir
        $courierId = $request->query('courier_id');
        if ($courierId && $courierId !== 'all') {
            if ($courierId === 'none' || $courierId === 'unassigned') {
                $query->whereNull('courier_id');
            } else {
                $query->where('courier_id', $courierId);
            }
        }

        // Filter by Order Status
        $status = $request->query('status');
        if ($status && $status !== 'all') {
            if (in_array($status, ['unpaid', 'waiting_confirmation', 'paid'])) {
                $query->where('payment_status', $status);
            } else {
                $query->where('status', $status);
            }
        }

        // Filter by Payment Status
        $paymentStatus = $request->query('payment_status');
        if ($paymentStatus && $paymentStatus !== 'all') {
            $query->where('payment_status', $paymentStatus);
        }

        // Filter by Date Range
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        if ($startDate && $endDate) {
            $start = Carbon::parse($startDate, 'Asia/Jakarta')->startOfDay();
            $end = Carbon::parse($endDate, 'Asia/Jakarta')->endOfDay();
            $query->whereBetween('created_at', [$start, $end]);
        }

        // Search by ID, User name, Santri name, Canteen name, Delivery location
        $search = $request->query('search');
        if ($search) {
            $cleanSearch = ltrim(trim($search), '#');
            $query->where(function ($q) use ($search, $cleanSearch) {
                if ($cleanSearch !== '') {
                    $q->where('id', 'like', "%{$cleanSearch}%");
                }
                $q->orWhere('recipient_santri_name', 'like', "%{$search}%")
                  ->orWhere('recipient_santri_room', 'like', "%{$search}%")
                  ->orWhere('recipient_phone', 'like', "%{$search}%")
                  ->orWhere('custom_notes', 'like', "%{$search}%")
                  ->orWhere('delivery_location', 'like', "%{$search}%")
                  ->orWhere('order_for', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                        ->orWhere('santri_name', 'like', "%{$search}%")
                        ->orWhere('santri_room', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('niy', 'like', "%{$search}%")
                        ->orWhere('teacher_unit', 'like', "%{$search}%");
                  })
                  ->orWhereHas('canteen', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('courier', function ($rq) use ($search) {
                      $rq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $orders = $query->get();

        return response()->json($orders);
    }

    /**
     * Get global order recapitulation for Admin
     */
    public function recap(Request $request)
    {
        $canteenId = $request->query('canteen_id');
        $courierId = $request->query('courier_id');
        $period = $request->query('period', 'day');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $query = Order::forRecap()->filterPeriod($period, $startDate, $endDate);

        if ($canteenId && $canteenId !== 'all') {
            $query->where('canteen_id', $canteenId);
        }

        if ($courierId && $courierId !== 'all') {
            if ($courierId === 'none' || $courierId === 'unassigned') {
                $query->whereNull('courier_id');
            } else {
                $query->where('courier_id', $courierId);
            }
        }

        $orders = $query->orderBy('created_at', 'asc')->orderBy('id', 'asc')->get();

        return response()->json(Order::calculateRecap($orders, $period));
    }

    /**
     * Export recap data and save directly to Google Drive (folder 04_laporan_keuangan)
     */
    public function exportRecapToDrive(Request $request)
    {
        $canteenId = $request->input('canteen_id', $request->query('canteen_id'));
        $courierId = $request->input('courier_id', $request->query('courier_id'));
        $period = $request->input('period', $request->query('period', 'day'));
        $startDate = $request->input('start_date', $request->query('start_date'));
        $endDate = $request->input('end_date', $request->query('end_date'));

        $query = Order::forRecap()->filterPeriod($period, $startDate, $endDate);

        if ($canteenId && $canteenId !== 'all') {
            $query->where('canteen_id', $canteenId);
        }

        if ($courierId && $courierId !== 'all') {
            if ($courierId === 'none' || $courierId === 'unassigned') {
                $query->whereNull('courier_id');
            } else {
                $query->where('courier_id', $courierId);
            }
        }

        $orders = $query->orderBy('created_at', 'asc')->orderBy('id', 'asc')->get();
        $recap = Order::calculateRecap($orders, $period);
        $summary = $recap['summary'] ?? [];

        // Build CSV rows
        $csvLines = [];
        $csvLines[] = ['LAPORAN REKAPITULASI PENJUALAN & KEUANGAN - HIGO PONDOK'];
        $csvLines[] = ['Waktu Ekspor', Carbon::now('Asia/Jakarta')->translatedFormat('l, d F Y H:i:s') . ' WIB'];
        $csvLines[] = ['Periode', strtoupper($period) . ($startDate ? " ({$startDate} s/d " . ($endDate ?: $startDate) . ")" : '')];
        $csvLines[] = ['Filter Toko', $canteenId && $canteenId !== 'all' ? "Toko #{$canteenId}" : 'Semua Toko'];
        $csvLines[] = ['Filter Kurir', $courierId && $courierId !== 'all' ? ($courierId === 'none' ? 'Tanpa Kurir' : "Kurir #{$courierId}") : 'Semua Kurir'];
        $csvLines[] = [];

        // 1. RINGKASAN GLOBAL
        $csvLines[] = ['--- RINGKASAN GLOBAL ---'];
        $csvLines[] = ['Indikator Keuangan', 'Nilai'];
        $csvLines[] = ['Total Pesanan', ($summary['total_orders'] ?? 0) . ' Pesanan'];
        $csvLines[] = ['Total Belanja Produk (Omzet Toko)', (float) ($summary['total_products'] ?? 0)];
        $csvLines[] = ['Total HPP / Modal Pokok', (float) ($summary['total_hpp'] ?? 0)];
        $csvLines[] = ['Total Estimasi Laba Toko', (float) ($summary['total_profit'] ?? 0)];
        $csvLines[] = ['Total Ongkir Diterima Kurir (Net)', (float) ($summary['total_courier_net_delivery_fee'] ?? $summary['total_delivery_fee'] ?? 0)];
        $csvLines[] = ['Total Biaya Admin Aplikasi', (float) ($summary['total_admin_fee'] ?? 0)];
        $csvLines[] = ['Total Potongan Kurir Masuk Kas Admin', (float) ($summary['total_courier_cut_to_admin'] ?? 0)];
        $csvLines[] = ['Total Subsidi Diskon Voucher (Kas Admin)', (float) ($summary['total_voucher_discount'] ?? 0)];
        $csvLines[] = ['Kas Admin Bersih (Net)', (float) ($summary['net_admin_fee'] ?? 0)];
        $csvLines[] = ['GRAND TOTAL KESELURUHAN', (float) ($summary['grand_total'] ?? 0)];
        $csvLines[] = [];

        // 2. REKAP PER TOKO
        $csvLines[] = ['--- REKAPITULASI PER TOKO / KANTIN ---'];
        $csvLines[] = ['ID Toko', 'Nama Toko', 'Jumlah Pesanan', 'Omzet Produk (Rp)', 'Total HPP (Rp)', 'Total Laba (Rp)', 'Ongkir (Rp)', 'Biaya Admin (Rp)', 'Grand Total (Rp)'];
        if (!empty($recap['canteen_recap'])) {
            foreach ($recap['canteen_recap'] as $c) {
                $csvLines[] = [
                    $c['canteen_id'],
                    $c['canteen_name'],
                    $c['order_count'],
                    (float) ($c['total_products'] ?? 0),
                    (float) ($c['total_hpp'] ?? 0),
                    (float) ($c['total_profit'] ?? 0),
                    (float) ($c['total_delivery_fee'] ?? 0),
                    (float) ($c['total_admin_fee'] ?? 0),
                    (float) ($c['grand_total'] ?? 0),
                ];
            }
        } else {
            $csvLines[] = ['-', 'Tidak ada transaksi', 0, 0, 0, 0, 0, 0, 0];
        }
        $csvLines[] = [];

        // 3. REKAP PER KURIR
        $csvLines[] = ['--- REKAPITULASI PENGIRIMAN PER KURIR ---'];
        $csvLines[] = ['ID Kurir', 'Nama Kurir', 'Jumlah Order', 'Ongkir Masuk Kurir (Rp)', 'Potongan Masuk Admin (Rp)', 'Grand Total Terkait (Rp)'];
        if (!empty($recap['courier_recap'])) {
            foreach ($recap['courier_recap'] as $cr) {
                $csvLines[] = [
                    $cr['courier_id'],
                    $cr['courier_name'],
                    $cr['order_count'],
                    (float) ($cr['net_delivery_fee'] ?? 0),
                    (float) ($cr['total_courier_cut_to_admin'] ?? 0),
                    (float) ($cr['grand_total'] ?? 0),
                ];
            }
        } else {
            $csvLines[] = ['-', 'Tidak ada pengiriman kurir', 0, 0, 0, 0];
        }
        $csvLines[] = [];

        // 4. BREAKDOWN PRODUK TERJUAL
        $csvLines[] = ['--- BREAKDOWN PRODUK TERJUAL ---'];
        $csvLines[] = ['ID Produk', 'Nama Produk', 'Toko', 'Jumlah Terjual (Qty)', 'Harga Jual (Rp)', 'Total Omzet (Rp)', 'Total Modal HPP (Rp)', 'Total Laba (Rp)'];
        $products = !empty($recap['today_product_breakdown']) ? $recap['today_product_breakdown'] : ($recap['product_breakdown'] ?? []);
        if (!empty($products)) {
            foreach ($products as $p) {
                $csvLines[] = [
                    $p['product_id'],
                    $p['name'],
                    $p['canteen_name'],
                    $p['qty'],
                    (float) ($p['hpj'] ?? 0),
                    (float) ($p['subtotal'] ?? 0),
                    (float) ($p['total_hpp'] ?? 0),
                    (float) ($p['profit'] ?? 0),
                ];
            }
        } else {
            $csvLines[] = ['-', 'Tidak ada produk terjual', '-', 0, 0, 0, 0, 0];
        }

        // Format CSV content using memory stream
        $f = fopen('php://memory', 'r+');
        foreach ($csvLines as $line) {
            fputcsv($f, $line);
        }
        rewind($f);
        $csvContent = stream_get_contents($f);
        fclose($f);

        // Standardized folder in Google Drive: 04_laporan_keuangan/{YYYY_MM}
        $now = Carbon::now('Asia/Jakarta');
        $monthFolder = $now->format('Y_m');
        $dateSlug = $startDate ? str_replace('-', '', $startDate) : $now->format('Ymd');
        $filename = "rekap_keuangan_{$period}_{$dateSlug}_" . $now->format('His') . ".csv";
        $fullPath = "04_laporan_keuangan/{$monthFolder}/{$filename}";

        $disk = config('filesystems.default', 'public');
        $driveUrl = null;
        try {
            // Prepend UTF-8 BOM so Microsoft Excel renders Indonesian accents and currency correctly
            $putOk = Storage::disk($disk)->put($fullPath, "\xEF\xBB\xBF" . $csvContent);
            if (!$putOk && $disk !== 'public') {
                throw new \RuntimeException("Storage::disk({$disk})->put returned false");
            }
            $driveUrl = Storage::disk($disk)->url($fullPath);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Drive export fallback to public disk: " . $e->getMessage());
            Storage::disk('public')->put($fullPath, "\xEF\xBB\xBF" . $csvContent);
            $driveUrl = Storage::disk('public')->url($fullPath);
        }

        // Log admin activity
        try {
            ActivityLog::create([
                'user_id' => $request->user() ? $request->user()->id : null,
                'action' => 'export_recap',
                'model_type' => Order::class,
                'model_id' => null,
                'description' => "Admin {$request->user()->name} mengekspor rekapitulasi keuangan ({$period}) ke Cloud Storage Google Drive: {$filename}",
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("ActivityLog export error: " . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Rekapitulasi keuangan berhasil diekspor dan disimpan ke Google Drive!',
            'filename' => $filename,
            'file_path' => $fullPath,
            'drive_url' => $driveUrl,
            'period' => $period,
            'orders_count' => $summary['total_orders'] ?? count($orders),
        ]);
    }

    /**
     * Move an order to Recycle Bin (Soft Delete)
     */
    public function destroy(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $order = Order::findOrFail($id);

            $orderId = $order->id;
            $canteenName = $order->canteen ? $order->canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? $order->user->name : "User #{$order->user_id}";
            $totalAmount = number_format($order->total_price, 0, ',', '.');

            // Soft delete order
            $order->delete();

            // Log activity
            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'trash_order',
                'model_type' => Order::class,
                'model_id' => $orderId,
                'description' => "Admin {$request->user()->name} memindahkan pesanan #{$orderId} ({$canteenName} - {$customerName} Rp {$totalAmount}) ke Kotak Sampah",
            ]);

            return response()->json([
                'message' => "Pesanan #{$orderId} berhasil dipindahkan ke Kotak Sampah.",
            ]);
        });
    }

    /**
     * List all deleted orders in Recycle Bin
     */
    public function trash(Request $request)
    {
        $trashedOrders = Order::onlyTrashed()
            ->with(['user', 'canteen', 'items.product', 'courier'])
            ->latest('deleted_at')
            ->get();

        return response()->json($trashedOrders);
    }

    /**
     * Restore an order from Recycle Bin
     */
    public function restore(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $order = Order::onlyTrashed()->with(['canteen', 'user'])->findOrFail($id);
            $orderId = $order->id;
            $canteenName = $order->canteen ? $order->canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? $order->user->name : "User #{$order->user_id}";

            $order->restore();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'restore_order',
                'model_type' => Order::class,
                'model_id' => $orderId,
                'description' => "Admin {$request->user()->name} memulihkan pesanan #{$orderId} ({$canteenName} - {$customerName}) dari Kotak Sampah",
            ]);

            return response()->json([
                'message' => "Pesanan #{$orderId} berhasil dipulihkan.",
            ]);
        });
    }

    /**
     * Permanently delete an order from Recycle Bin (Hard Delete with File Cleanup)
     */
    public function forceDelete(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $order = Order::onlyTrashed()->with(['items', 'canteen', 'user'])->findOrFail($id);

            // Delete proof files from public storage
            $deleteFiles = function ($field) {
                if (empty($field)) return;
                $files = is_array($field) ? $field : [$field];
                foreach ($files as $file) {
                    if ($file && is_string($file)) {
                        Storage::disk('public')->delete($file);
                    }
                }
            };

            $deleteFiles($order->proof_of_delivery);
            $deleteFiles($order->proof_of_purchase);
            $deleteFiles($order->proof_of_payment);
            $deleteFiles($order->proof_courier_paid);

            $orderId = $order->id;
            $canteenName = $order->canteen ? $order->canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? $order->user->name : "User #{$order->user_id}";
            $totalAmount = number_format($order->total_price, 0, ',', '.');

            // Force delete items & order
            $order->items()->delete();
            $order->forceDelete();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'force_delete_order',
                'model_type' => Order::class,
                'model_id' => $orderId,
                'description' => "Admin {$request->user()->name} menghapus permanen pesanan #{$orderId} ({$canteenName} - {$customerName} Rp {$totalAmount})",
            ]);

            return response()->json([
                'message' => "Pesanan #{$orderId} berhasil dihapus permanen beserta berkas buktinya.",
            ]);
        });
    }

    /**
     * Empty entire Recycle Bin (Permanently delete all trashed orders)
     */
    public function emptyTrash(Request $request)
    {
        return DB::transaction(function () use ($request) {
            $trashedOrders = Order::onlyTrashed()->with('items')->get();
            $count = $trashedOrders->count();

            if ($count === 0) {
                return response()->json([
                    'message' => "Kotak sampah sudah kosong.",
                ]);
            }

            $deleteFiles = function ($field) {
                if (empty($field)) return;
                $files = is_array($field) ? $field : [$field];
                foreach ($files as $file) {
                    if ($file && is_string($file)) {
                        Storage::disk('public')->delete($file);
                    }
                }
            };

            foreach ($trashedOrders as $order) {
                $deleteFiles($order->proof_of_delivery);
                $deleteFiles($order->proof_of_purchase);
                $deleteFiles($order->proof_of_payment);
                $deleteFiles($order->proof_courier_paid);
                $order->items()->delete();
                $order->forceDelete();
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'empty_trash_orders',
                'model_type' => Order::class,
                'model_id' => null,
                'description' => "Admin {$request->user()->name} mengosongkan Kotak Sampah ({$count} pesanan dihapus permanen)",
            ]);

            return response()->json([
                'message' => "Kotak sampah berhasil dikosongkan. {$count} pesanan telah dihapus permanen.",
            ]);
        });
    }

    /**
     * Cancel an order (Admin can cancel ANY order, including completed ones)
     */
    public function cancel(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $order = Order::with(['items.product', 'canteen', 'user'])->findOrFail($id);
            $orderId = $order->id;
            $prevStatus = $order->status;
            $canteenName = $order->canteen ? $order->canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? $order->user->name : "User #{$order->user_id}";

            $reason = $request->input('reason', 'Dibatalkan oleh Admin');

            // If order was completed, revert balance and log it
            if ($prevStatus === 'completed') {
                $canteen = $order->canteen;
                if ($canteen) {
                    $canteenNet = (float) $order->canteen_income;
                    \App\Domains\Canteen\CanteenBalanceLedger::record(
                        $canteen,
                        'out',
                        $canteenNet,
                        "Pembalikan laba pesanan #{$orderId} karena dibatalkan oleh Admin",
                        $orderId
                    );
                    $canteen->decrement('balance', min((float)$canteen->balance, $canteenNet));
                    $canteen->decrement('sold_count', 1);

                    \App\Domains\Admin\PaymentLog::create([
                        'user_id' => $canteen->user_id,
                        'order_id' => $orderId,
                        'amount' => $canteenNet,
                        'type' => 'order_cancel_reversal',
                        'description' => "Pembalikan saldo kantin untuk pesanan #{$orderId} dibatalkan Admin",
                    ]);
                }

                $courier = \App\Domains\Auth\User::find($order->courier_id);
                $deliveryFee = (float) $order->delivery_fee;
                if ($courier && $deliveryFee > 0) {
                    $courier->decrement('balance', min((float)$courier->balance, $deliveryFee));
                    \App\Domains\Admin\PaymentLog::create([
                        'user_id' => $courier->id,
                        'order_id' => $orderId,
                        'amount' => $deliveryFee,
                        'type' => 'courier_fee_reversal',
                        'description' => "Pembalikan ongkir kurir pesanan #{$orderId} dibatalkan Admin",
                    ]);
                }
            }

            // If order was completed or processing, restore stock and decrement sold_count
            if ($prevStatus === 'completed' || $prevStatus === 'processing') {
                foreach ($order->items as $item) {
                    if ($item->product) {
                        $item->product->increment('stock', $item->quantity);
                        $item->product->decrement('sold_count', $item->quantity);
                    }
                }
            }

            $order->status = 'cancelled';
            $order->save();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'cancel_order',
                'model_type' => Order::class,
                'model_id' => $orderId,
                'description' => "Admin {$request->user()->name} membatalkan pesanan #{$orderId} ({$canteenName} - {$customerName}). Status sebelumnya: {$prevStatus}. Alasan: {$reason}",
            ]);

            return response()->json([
                'message' => "Pesanan #{$orderId} berhasil dibatalkan.",
                'order' => $order->load(['user', 'canteen', 'courier', 'items.product'])
            ]);
        });
    }

    /**
     * Update order status (Admin can change status or revert completed orders & update payment status)
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'nullable|in:pending,processing,completed,cancelled',
            'payment_status' => 'nullable|in:unpaid,waiting_confirmation,paid',
            'courier_id' => 'nullable|integer',
            'target_date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $order = Order::with(['items.product', 'canteen.couriers:users.id,users.name', 'user'])->findOrFail($id);
            $orderId = $order->id;
            $prevStatus = $order->status;
            $prevPaymentStatus = $order->payment_status;
            $newStatus = $request->input('status', $prevStatus);
            $newPaymentStatus = $request->input('payment_status', $prevPaymentStatus);
            $canteen = $order->canteen;
            $canteenName = $canteen ? $canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? $order->user->name : "User #{$order->user_id}";

            // Jika status pembayaran ditandai paid dan status pesanan saat ini pending (dan status tidak diubah manual), otomatis lanjutkan ke processing
            if ($newPaymentStatus === 'paid' && $prevStatus === 'pending' && !$request->has('status')) {
                $newStatus = 'processing';
            }

            if ($prevStatus === $newStatus && $prevPaymentStatus === $newPaymentStatus && !$request->has('courier_id') && !$request->filled('target_date')) {
                return response()->json([
                    'message' => 'Status pesanan tidak berubah',
                    'order' => $order
                ]);
            }

            // Validasi & penugasan kurir otomatis jika status diubah menjadi processing (atau dilanjutkan dari cancelled/pending)
            if ($newStatus === 'processing') {
                $assignedCouriers = DB::table('canteen_couriers')
                    ->where('canteen_id', $order->canteen_id)
                    ->pluck('courier_id')
                    ->toArray();

                if (empty($assignedCouriers)) {
                    $fallbackCourierId = \App\Domains\Auth\User::role('kurir')->value('id');
                    if ($fallbackCourierId) {
                        $assignedCouriers = [$fallbackCourierId];
                    }
                }

                if (empty($assignedCouriers)) {
                    return response()->json([
                        'message' => "Toko \"{$canteenName}\" belum memiliki kurir yang ditugaskan. Silakan tugaskan kurir ke toko ini terlebih dahulu sebelum melanjutkan pesanan.",
                        'error_code' => 'NO_COURIER_ASSIGNED',
                        'canteen_id' => $order->canteen_id,
                        'canteen_name' => $canteenName,
                    ], 422);
                }

                if ($request->filled('courier_id') && in_array((int)$request->courier_id, array_map('intval', $assignedCouriers))) {
                    $order->courier_id = (int)$request->courier_id;
                } else {
                    if (!$order->courier_id || !in_array((int)$order->courier_id, array_map('intval', $assignedCouriers))) {
                        $order->courier_id = $assignedCouriers[0];
                    }
                }
            }

            // Adjust product sold_count and stock if transitioning from/to completed or cancelled
            if ($newStatus && $prevStatus !== $newStatus) {
                if ($newStatus === 'completed' && $prevStatus !== 'completed') {
                    // 1. Kredit laba bersih ke kantin
                    if ($canteen) {
                        $canteenNet = (float) $order->canteen_income;
                        \App\Domains\Canteen\CanteenBalanceLedger::record(
                            $canteen,
                            'in',
                            $canteenNet,
                            "Penerimaan laba bersih pesanan #{$orderId} (Diselesaikan oleh Admin)",
                            $orderId
                        );
                        $canteen->increment('balance', $canteenNet);
                        $canteen->increment('sold_count', 1);

                        \App\Domains\Admin\PaymentLog::create([
                            'user_id' => $canteen->user_id,
                            'order_id' => $orderId,
                            'amount' => $canteenNet,
                            'type' => 'order_payment',
                            'description' => "Penerimaan laba bersih pesanan #{$orderId} (Diselesaikan Admin)",
                        ]);
                    }

                    // 2. Kredit ongkir ke kurir
                    $courier = \App\Domains\Auth\User::find($order->courier_id);
                    $deliveryFee = (float) $order->delivery_fee;
                    if ($courier && $deliveryFee > 0) {
                        $courier->increment('balance', $deliveryFee);
                        \App\Domains\Admin\PaymentLog::create([
                            'user_id' => $courier->id,
                            'order_id' => $orderId,
                            'amount' => $deliveryFee,
                            'type' => 'courier_fee',
                            'description' => "Penerimaan ongkir pesanan #{$orderId} (Diselesaikan Admin)",
                        ]);
                    }

                    foreach ($order->items as $item) {
                        if ($item->product) {
                            $item->product->increment('sold_count', $item->quantity);
                            $item->product->decrement('stock', $item->quantity);
                        }
                    }

                    $order->dispatchCompletedNotifications();
                } elseif ($prevStatus === 'completed' && $newStatus !== 'completed') {
                    // 1. Revert laba bersih kantin
                    if ($canteen) {
                        $canteenNet = (float) $order->canteen_income;
                        \App\Domains\Canteen\CanteenBalanceLedger::record(
                            $canteen,
                            'out',
                            $canteenNet,
                            "Pembalikan laba pesanan #{$orderId} karena status diubah dari Selesai ke " . ucfirst($newStatus) . " oleh Admin",
                            $orderId
                        );
                        $canteen->decrement('balance', min((float)$canteen->balance, $canteenNet));
                        $canteen->decrement('sold_count', 1);

                        \App\Domains\Admin\PaymentLog::create([
                            'user_id' => $canteen->user_id,
                            'order_id' => $orderId,
                            'amount' => $canteenNet,
                            'type' => 'order_cancel_reversal',
                            'description' => "Pembalikan laba kantin pesanan #{$orderId} diubah status oleh Admin",
                        ]);
                    }

                    // 2. Revert ongkir kurir
                    $courier = \App\Domains\Auth\User::find($order->courier_id);
                    $deliveryFee = (float) $order->delivery_fee;
                    if ($courier && $deliveryFee > 0) {
                        $courier->decrement('balance', min((float)$courier->balance, $deliveryFee));
                        \App\Domains\Admin\PaymentLog::create([
                            'user_id' => $courier->id,
                            'order_id' => $orderId,
                            'amount' => $deliveryFee,
                            'type' => 'courier_fee_reversal',
                            'description' => "Pembalikan ongkir kurir pesanan #{$orderId} diubah status oleh Admin",
                        ]);
                    }

                    foreach ($order->items as $item) {
                        if ($item->product) {
                            $item->product->decrement('sold_count', $item->quantity);
                            $item->product->increment('stock', $item->quantity);
                        }
                    }
                } elseif ($prevStatus === 'cancelled' && in_array($newStatus, ['processing', 'completed'])) {
                    // Jika pesanan dibatalkan lalu dilanjutkan ke proses: potong stok kembali & tambahkan sold_count
                    foreach ($order->items as $item) {
                        if ($item->product) {
                            $item->product->decrement('stock', $item->quantity);
                            $item->product->increment('sold_count', $item->quantity);
                        }
                    }
                } elseif ($prevStatus === 'processing' && $newStatus === 'cancelled') {
                    // Jika pesanan sedang diproses lalu dibatalkan: pulihkan stok & kurangi sold_count
                    foreach ($order->items as $item) {
                        if ($item->product) {
                            $item->product->increment('stock', $item->quantity);
                            $item->product->decrement('sold_count', $item->quantity);
                        }
                    }
                }
                $order->status = $newStatus;
            }

            if ($newPaymentStatus && $prevPaymentStatus !== $newPaymentStatus) {
                $order->payment_status = $newPaymentStatus;

                // Jika status pembayaran berubah dari unpaid menjadi paid atau waiting_confirmation, pindahkan created_at ke hari pembayaran
                if ($prevPaymentStatus === 'unpaid' && in_array($newPaymentStatus, ['paid', 'waiting_confirmation'])) {
                    $now = now('Asia/Jakarta');
                    $order->created_at = $now;
                    $order->items()->update(['created_at' => $now]);
                }
            }

            // Perubahan tanggal pesanan (jadwalkan ke besok atau tanggal tertentu untuk pesanan toko ini)
            $dateChangeMsg = '';
            if ($request->filled('target_date')) {
                $targetDate = Carbon::parse($request->target_date, 'Asia/Jakarta');
                if (strlen($request->target_date) <= 10) {
                    $targetDate = $targetDate->setTime(Carbon::now('Asia/Jakarta')->hour, Carbon::now('Asia/Jakarta')->minute, Carbon::now('Asia/Jakarta')->second);
                }
                $order->created_at = $targetDate;
                $order->items()->update(['created_at' => $targetDate]);
                $formattedDate = $targetDate->translatedFormat('d M Y');
                $dateChangeMsg = " Dijadwalkan ke tanggal: {$formattedDate}.";
            }

            $order->save();

            $courierAssignedMsg = '';
            if ($order->courier_id) {
                $courierUser = \App\Domains\Auth\User::find($order->courier_id);
                if ($courierUser) {
                    $courierAssignedMsg = " Kurir ({$courierUser->name}) otomatis menerima pesanan.";
                }
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'update_order_status',
                'model_type' => Order::class,
                'model_id' => $orderId,
                'description' => "Admin {$request->user()->name} memperbarui pesanan #{$orderId} ({$canteenName} - {$customerName}): Status [{$prevStatus} -> {$newStatus}], Bayar [{$prevPaymentStatus} -> {$newPaymentStatus}].{$courierAssignedMsg}{$dateChangeMsg}",
            ]);

            return response()->json([
                'message' => "Status pesanan #{$orderId} berhasil diperbarui.{$courierAssignedMsg}{$dateChangeMsg}",
                'order' => $order->load(['user', 'canteen.couriers:users.id,users.name', 'courier', 'items.product'])
            ]);
        });
    }

    /**
     * Upload payment proof on behalf of user / santri by Admin
     */
    public function uploadPaymentProof(AdminUploadPaymentProofRequest $request, $id)
    {
        $uploadResult = DB::transaction(function () use ($request, $id) {
            $order = Order::with(['user', 'canteen', 'courier', 'items.product'])->lockForUpdate()->findOrFail($id);

            $files = $request->file('proof_of_payment');
            if (!is_array($files)) {
                $files = [$files];
            }

            // Simpan berkas di disk lokal 'public' terlebih dahulu agar respons upload instan (<0.3s)
            $paths = [];
            foreach ($files as $file) {
                if ($file) {
                    $paths[] = $this->storeOrderProofImage($file, $order, 'proof', 'public');
                }
            }

            $existingProofs = is_array($order->proof_of_payment) ? $order->proof_of_payment : ($order->proof_of_payment ? [$order->proof_of_payment] : []);
            $mergedPaths = array_values(array_unique(array_merge($existingProofs, $paths)));

            // Default payment status to 'paid' when admin uploads, or accept admin's choice
            $newPaymentStatus = $request->input('payment_status', 'paid');
            $now = now('Asia/Jakarta');

            if ($request->filled('admin_notes')) {
                $order->admin_notes = $request->input('admin_notes');
            }

            // Pindahkan tanggal pesanan otomatis ke hari pembayaran saat bukti bayar diunggah (bukan saat checkout)
            $order->created_at = $now;
            $order->proof_of_payment = $mergedPaths;
            $order->payment_status = $newPaymentStatus;

            // Jika status pembayaran ditandai Lunas dan pesanan masih pending, otomatis lanjutkan ke processing & kurir
            if ($newPaymentStatus === 'paid' && $order->status === 'pending') {
                $order->status = 'processing';
                if (!$order->courier_id) {
                    $assignedCourierId = DB::table('canteen_couriers')
                        ->where('canteen_id', $order->canteen_id)
                        ->value('courier_id');
                    if (!$assignedCourierId) {
                        $assignedCourierId = \App\Domains\Auth\User::role('kurir')->value('id');
                    }
                    if ($assignedCourierId) {
                        $order->courier_id = $assignedCourierId;
                    }
                }
            }

            $order->save();
            $order->items()->update(['created_at' => $now]);

            // Sync payment proof, payment status, dan tanggal created_at ke seluruh pesanan dalam checkout batch yang sama
            if ($order->checkout_id) {
                $linkedOrders = Order::where('checkout_id', $order->checkout_id)
                    ->where('id', '!=', $order->id)
                    ->lockForUpdate()
                    ->get();
                foreach ($linkedOrders as $linked) {
                    $linkedExisting = is_array($linked->proof_of_payment) ? $linked->proof_of_payment : ($linked->proof_of_payment ? [$linked->proof_of_payment] : []);
                    $linkedMerged = array_values(array_unique(array_merge($linkedExisting, $paths)));
                    $linked->created_at = $now;
                    $linked->proof_of_payment = $linkedMerged;
                    $linked->payment_status = $newPaymentStatus;

                    if ($newPaymentStatus === 'paid' && $linked->status === 'pending') {
                        $linked->status = 'processing';
                        if (!$linked->courier_id) {
                            $assignedCourierId = DB::table('canteen_couriers')
                                ->where('canteen_id', $linked->canteen_id)
                                ->value('courier_id');
                            if (!$assignedCourierId) {
                                $assignedCourierId = \App\Domains\Auth\User::role('kurir')->value('id');
                            }
                            if ($assignedCourierId) {
                                $linked->courier_id = $assignedCourierId;
                            }
                        }
                    }

                    if ($request->filled('admin_notes')) {
                        $linked->admin_notes = $request->input('admin_notes');
                    }
                    $linked->save();
                    $linked->items()->update(['created_at' => $now]);
                }
            }

            $canteenName = $order->canteen ? $order->canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? ($order->user->santri_name ?: $order->user->name) : "User #{$order->user_id}";
            $filesCount = count($paths);
            $notesLog = $order->admin_notes ? " | Catatan: {$order->admin_notes}" : '';

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'upload_payment_proof',
                'model_type' => Order::class,
                'model_id' => $order->id,
                'description' => "Admin {$request->user()->name} mengunggah {$filesCount} berkas bukti pembayaran untuk pesanan #{$order->id} ({$canteenName} - {$customerName}). Status pembayaran: {$newPaymentStatus}{$notesLog}",
            ]);

            return [
                'order' => $order,
                'paths' => $paths,
                'newPaymentStatus' => $newPaymentStatus,
            ];
        });

        $order = $uploadResult['order'];
        $paths = $uploadResult['paths'];
        $newPaymentStatus = $uploadResult['newPaymentStatus'];

        // Sinkronisasi ke Google Drive & Scanner AI di latar belakang (Non-Blocking Fast Response)
        if (!empty($paths)) {
            $orderId = $order->id;
            $firstLocalPath = $paths[0];
            dispatch(function () use ($orderId, $firstLocalPath) {
                try {
                    $order = Order::find($orderId);
                    if (!$order) return;

                    // 1. Eksekusi scanner AI pada file lokal (sangat cepat & akurat)
                    try {
                        $scanner = app(\App\Domains\Canteen\Services\ReceiptScannerService::class);
                        $firstScan = $scanner->scanReceipt($firstLocalPath);
                        if (!empty($firstScan['is_transfer_receipt'])) {
                            $order->payment_ocr_data = $firstScan;
                            if (!empty($firstScan['ref_number'])) {
                                $order->payment_ref_number = $firstScan['ref_number'];
                            }
                            $order->save();
                            if ($order->checkout_id) {
                                Order::where('checkout_id', $order->checkout_id)
                                    ->where('id', '!=', $order->id)
                                    ->update([
                                        'payment_ocr_data' => json_encode($firstScan),
                                        'payment_ref_number' => $order->payment_ref_number
                                    ]);
                            }
                        }
                    } catch (\Throwable $scanErr) {
                        \Illuminate\Support\Facades\Log::warning("[Admin uploadPaymentProof] OCR background failed: " . $scanErr->getMessage());
                    }

                    // 2. Pindahkan bukti dari disk lokal ke Google Drive, lalu hapus file fisik lokal agar server bersih
                    $controller = app(\App\Http\Controllers\Controller::class);
                    $controller->syncProofToGoogleDrive($order, 'proof_of_payment');
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning("[Admin uploadPaymentProof] Background sync to Google Drive failed: " . $e->getMessage());
                }
            })->afterResponse();
        }

        return response()->json([
            'message' => "Bukti pembayaran berhasil diunggah! Status pembayaran ditandai sebagai " . ($newPaymentStatus === 'paid' ? 'Lunas.' : 'Menunggu Validasi.'),
            'order' => $order->fresh()->load(['user', 'canteen', 'courier', 'items.product'])
        ]);
    }

    /**
     * Delete a specific uploaded photo proof from order by Admin
     */
    public function deleteProof(Request $request, $id)
    {
        $request->validate([
            'type' => 'required|in:proof_of_payment,proof_of_purchase,proof_of_delivery',
            'path' => 'required|string',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $order = Order::with(['user', 'canteen', 'courier', 'items.product'])->lockForUpdate()->findOrFail($id);

            $type = $request->input('type');
            $targetPath = $request->input('path');
            $currentArray = is_array($order->$type) ? $order->$type : ($order->$type ? [$order->$type] : []);

            $filtered = array_values(array_filter($currentArray, function ($p) use ($targetPath) {
                return $p !== $targetPath;
            }));

            $order->update([
                $type => count($filtered) > 0 ? $filtered : null,
            ]);

            // Physically delete the file from storage (Google Drive and local)
            $defaultDisk = config('filesystems.default', 'public');
            try {
                if ($defaultDisk === 'google') {
                    if (str_contains($targetPath, 'drive.google.com') && preg_match('/id=([a-zA-Z0-9_-]+)/', $targetPath, $m)) {
                        Storage::disk('google')->delete($m[1]);
                    } else {
                        Storage::disk('google')->delete($targetPath);
                    }
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Drive deletion fallback: " . $e->getMessage());
            }
            Storage::disk('public')->delete($targetPath);

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'delete_order_proof',
                'model_type' => Order::class,
                'model_id' => $order->id,
                'description' => "Admin {$request->user()->name} menghapus berkas bukti ({$type}) pada pesanan #{$order->id}",
            ]);

            return response()->json([
                'message' => 'Berkas bukti berhasil dihapus.',
                'order' => $order->fresh()->load(['user', 'canteen', 'courier', 'items.product'])
            ]);
        });
    }

    /**
     * Batch soft delete orders in a group / container (Hapus 1 Kesatuan Wadah)
     */
    public function batchDestroy(Request $request)
    {
        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer',
        ]);

        return DB::transaction(function () use ($request) {
            $orders = Order::with(['canteen', 'user'])->whereIn('id', $request->order_ids)->get();
            $count = $orders->count();

            if ($count === 0) {
                return response()->json(['message' => 'Tidak ada pesanan yang ditemukan.'], 404);
            }

            foreach ($orders as $order) {
                $order->delete();
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'batch_trash_orders',
                'model_type' => Order::class,
                'model_id' => null,
                'description' => "Admin {$request->user()->name} memindahkan 1 kesatuan wadah ({$count} pesanan toko) ke Kotak Sampah",
            ]);

            return response()->json([
                'message' => "{$count} pesanan dalam 1 kesatuan wadah berhasil dipindahkan ke Kotak Sampah.",
                'deleted_ids' => $request->order_ids,
            ]);
        });
    }

    /**
     * Batch update status, payment status, and/or schedule date for an order group (Ubah / Jadwalkan 1 Kesatuan Wadah)
     */
    public function batchUpdateStatus(Request $request)
    {
        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer',
            'status' => 'nullable|in:pending,processing,completed,cancelled',
            'payment_status' => 'nullable|in:unpaid,waiting_confirmation,paid',
            'courier_id' => 'nullable|integer',
            'target_date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($request) {
            $orders = Order::with(['items.product', 'canteen.couriers:users.id,users.name', 'user'])
                ->whereIn('id', $request->order_ids)
                ->lockForUpdate()
                ->get();

            $count = $orders->count();
            if ($count === 0) {
                return response()->json(['message' => 'Tidak ada pesanan yang ditemukan.'], 404);
            }

            $newStatus = $request->input('status');
            $newPaymentStatus = $request->input('payment_status');
            $courierId = $request->input('courier_id');
            $targetDate = null;

            if ($request->filled('target_date')) {
                $targetDate = Carbon::parse($request->target_date, 'Asia/Jakarta');
                if (strlen($request->target_date) <= 10) {
                    $targetDate = $targetDate->setTime(Carbon::now('Asia/Jakarta')->hour, Carbon::now('Asia/Jakarta')->minute, Carbon::now('Asia/Jakarta')->second);
                }
            }

            foreach ($orders as $order) {
                $orderId = $order->id;
                $prevStatus = $order->status;
                $prevPaymentStatus = $order->payment_status;
                $canteen = $order->canteen;

                // Courier assignment if status processing
                $effectiveStatus = $newStatus;
                if ($newPaymentStatus === 'paid' && $prevStatus === 'pending' && !$effectiveStatus) {
                    $effectiveStatus = 'processing';
                }

                if ($effectiveStatus === 'processing') {
                    $assignedCouriers = DB::table('canteen_couriers')
                        ->where('canteen_id', $order->canteen_id)
                        ->pluck('courier_id')
                        ->toArray();

                    if (empty($assignedCouriers)) {
                        $fallbackCourierId = \App\Domains\Auth\User::role('kurir')->value('id');
                        if ($fallbackCourierId) {
                            $assignedCouriers = [$fallbackCourierId];
                        }
                    }

                    if (!empty($assignedCouriers)) {
                        if ($courierId && in_array((int)$courierId, array_map('intval', $assignedCouriers))) {
                            $order->courier_id = (int)$courierId;
                        } elseif (!$order->courier_id || !in_array((int)$order->courier_id, array_map('intval', $assignedCouriers))) {
                            $order->courier_id = $assignedCouriers[0];
                        }
                    }
                } elseif ($courierId) {
                    $order->courier_id = (int)$courierId;
                }

                // Financial balance and stock handling if status changed
                if ($effectiveStatus && $prevStatus !== $effectiveStatus) {
                    if ($effectiveStatus === 'completed' && $prevStatus !== 'completed') {
                        if ($canteen) {
                            $canteenNet = (float) $order->canteen_income;
                            \App\Domains\Canteen\CanteenBalanceLedger::record(
                                $canteen,
                                'in',
                                $canteenNet,
                                "Penerimaan laba bersih pesanan #{$orderId} (Diselesaikan massal Admin)",
                                $orderId
                            );
                            $canteen->increment('balance', $canteenNet);
                            $canteen->increment('sold_count', 1);

                            \App\Domains\Admin\PaymentLog::create([
                                'user_id' => $canteen->user_id,
                                'order_id' => $orderId,
                                'amount' => $canteenNet,
                                'type' => 'order_payment',
                                'description' => "Penerimaan laba bersih pesanan #{$orderId} (Diselesaikan massal Admin)",
                            ]);
                        }

                        $courier = \App\Domains\Auth\User::find($order->courier_id);
                        $deliveryFee = (float) $order->delivery_fee;
                        if ($courier && $deliveryFee > 0) {
                            $courier->increment('balance', $deliveryFee);
                            \App\Domains\Admin\PaymentLog::create([
                                'user_id' => $courier->id,
                                'order_id' => $orderId,
                                'amount' => $deliveryFee,
                                'type' => 'courier_fee',
                                'description' => "Penerimaan ongkir pesanan #{$orderId} (Diselesaikan massal Admin)",
                            ]);
                        }

                        foreach ($order->items as $item) {
                            if ($item->product) {
                                $item->product->increment('sold_count', $item->quantity);
                                $item->product->decrement('stock', $item->quantity);
                            }
                        }

                        $order->dispatchCompletedNotifications();
                    } elseif ($prevStatus === 'completed' && $effectiveStatus !== 'completed') {
                        if ($canteen) {
                            $canteenNet = (float) $order->canteen_income;
                            \App\Domains\Canteen\CanteenBalanceLedger::record(
                                $canteen,
                                'out',
                                $canteenNet,
                                "Pembalikan laba pesanan #{$orderId} status diubah massal oleh Admin",
                                $orderId
                            );
                            $canteen->decrement('balance', min((float)$canteen->balance, $canteenNet));
                            $canteen->decrement('sold_count', 1);

                            \App\Domains\Admin\PaymentLog::create([
                                'user_id' => $canteen->user_id,
                                'order_id' => $orderId,
                                'amount' => $canteenNet,
                                'type' => 'order_cancel_reversal',
                                'description' => "Pembalikan laba kantin pesanan #{$orderId} diubah massal oleh Admin",
                            ]);
                        }

                        $courier = \App\Domains\Auth\User::find($order->courier_id);
                        $deliveryFee = (float) $order->delivery_fee;
                        if ($courier && $deliveryFee > 0) {
                            $courier->decrement('balance', min((float)$courier->balance, $deliveryFee));
                            \App\Domains\Admin\PaymentLog::create([
                                'user_id' => $courier->id,
                                'order_id' => $orderId,
                                'amount' => $deliveryFee,
                                'type' => 'courier_fee_reversal',
                                'description' => "Pembalikan ongkir kurir pesanan #{$orderId} diubah massal oleh Admin",
                            ]);
                        }

                        foreach ($order->items as $item) {
                            if ($item->product) {
                                $item->product->decrement('sold_count', $item->quantity);
                                $item->product->increment('stock', $item->quantity);
                            }
                        }
                    } elseif ($prevStatus === 'cancelled' && in_array($effectiveStatus, ['processing', 'completed'])) {
                        foreach ($order->items as $item) {
                            if ($item->product) {
                                $item->product->decrement('stock', $item->quantity);
                                $item->product->increment('sold_count', $item->quantity);
                            }
                        }
                    } elseif ($prevStatus === 'processing' && $effectiveStatus === 'cancelled') {
                        foreach ($order->items as $item) {
                            if ($item->product) {
                                $item->product->increment('stock', $item->quantity);
                                $item->product->decrement('sold_count', $item->quantity);
                            }
                        }
                    }
                    $order->status = $effectiveStatus;
                }

                if ($newPaymentStatus && $prevPaymentStatus !== $newPaymentStatus) {
                    $order->payment_status = $newPaymentStatus;
                }

                if ($targetDate) {
                    $order->created_at = $targetDate;
                    $order->items()->update(['created_at' => $targetDate]);
                }

                if ($request->has('admin_notes')) {
                    $order->admin_notes = $request->input('admin_notes');
                }

                $order->save();
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'batch_update_orders',
                'model_type' => Order::class,
                'model_id' => null,
                'description' => "Admin {$request->user()->name} memperbarui status 1 kesatuan wadah ({$count} pesanan toko)",
            ]);

            return response()->json([
                'message' => "{$count} pesanan dalam 1 kesatuan wadah berhasil diperbarui.",
                'updated_count' => $count,
            ]);
        });
    }

    /**
     * Update catatan khusus Superadmin (Admin Notes) pada pesanan
     */
    public function updateAdminNotes(Request $request, $id)
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:2000',
            'sync_checkout' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $order = Order::with(['user', 'canteen', 'courier', 'items.product'])->lockForUpdate()->findOrFail($id);
            $newNotes = $request->input('admin_notes');
            $order->admin_notes = $newNotes;
            $order->save();

            // Jika diperintahkan sync ke seluruh wadah/checkout gabungan
            if ($request->boolean('sync_checkout') && !empty($order->checkout_id)) {
                Order::where('checkout_id', $order->checkout_id)
                    ->where('id', '!=', $order->id)
                    ->lockForUpdate()
                    ->update(['admin_notes' => $newNotes]);
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'update_order_notes',
                'model_type' => Order::class,
                'model_id' => $order->id,
                'description' => "Admin {$request->user()->name} memperbarui catatan pesanan #{$order->id}: " . ($newNotes ?: '(Catatan dikosongkan)'),
            ]);

            return response()->json([
                'message' => 'Catatan pesanan berhasil diperbarui!',
                'order' => $order->fresh()->load(['user', 'canteen', 'courier', 'items.product']),
            ]);
        });
    }
}
