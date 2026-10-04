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
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
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

                // Sync payment status to all orders in the same checkout batch
                if ($order->checkout_id) {
                    $linkedOrders = Order::where('checkout_id', $order->checkout_id)
                        ->where('id', '!=', $order->id)
                        ->get();
                    foreach ($linkedOrders as $linked) {
                        $linked->payment_status = $newPaymentStatus;
                        if ($prevPaymentStatus === 'unpaid' && in_array($newPaymentStatus, ['paid', 'waiting_confirmation'])) {
                            $linked->created_at = $order->created_at;
                            $linked->items()->update(['created_at' => $order->created_at]);
                        }
                        $linked->save();
                    }
                }
            }

            // Perubahan tanggal pesanan (jadwalkan ke besok atau tanggal tertentu)
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

                if ($order->checkout_id) {
                    $linkedOrders = Order::where('checkout_id', $order->checkout_id)
                        ->where('id', '!=', $order->id)
                        ->get();
                    foreach ($linkedOrders as $linked) {
                        $linked->created_at = $targetDate;
                        $linked->save();
                        $linked->items()->update(['created_at' => $targetDate]);
                    }
                }
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
        return DB::transaction(function () use ($request, $id) {
            $order = Order::with(['user', 'canteen', 'courier', 'items.product'])->lockForUpdate()->findOrFail($id);

            $files = $request->file('proof_of_payment');
            if (!is_array($files)) {
                $files = [$files];
            }

            // Target user for folder path naming: the user who owns the order (or fallback to admin)
            $targetUser = $order->user ?: $request->user();

            $paths = [];
            foreach ($files as $file) {
                if ($file) {
                    $paths[] = $this->storeOrderProofImage($file, $order, 'proof');
                }
            }

            $existingProofs = is_array($order->proof_of_payment) ? $order->proof_of_payment : ($order->proof_of_payment ? [$order->proof_of_payment] : []);
            $mergedPaths = array_values(array_unique(array_merge($existingProofs, $paths)));

            // Default payment status to 'paid' when admin uploads, or accept admin's choice
            $newPaymentStatus = $request->input('payment_status', 'paid');
            $now = now('Asia/Jakarta');

            // Pindahkan tanggal pesanan otomatis ke hari pembayaran saat bukti bayar diunggah (bukan saat checkout)
            $order->created_at = $now;
            $order->proof_of_payment = $mergedPaths;
            $order->payment_status = $newPaymentStatus;
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
                    $linked->save();
                    $linked->items()->update(['created_at' => $now]);
                }
            }

            $canteenName = $order->canteen ? $order->canteen->name : "Kantin #{$order->canteen_id}";
            $customerName = $order->user ? ($order->user->santri_name ?: $order->user->name) : "User #{$order->user_id}";
            $filesCount = count($paths);

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'upload_payment_proof',
                'model_type' => Order::class,
                'model_id' => $order->id,
                'description' => "Admin {$request->user()->name} mengunggah {$filesCount} berkas bukti pembayaran untuk pesanan #{$order->id} ({$canteenName} - {$customerName}). Status pembayaran: {$newPaymentStatus}",
            ]);

            return response()->json([
                'message' => "Bukti pembayaran berhasil diunggah! Status pembayaran ditandai sebagai " . ($newPaymentStatus === 'paid' ? 'Lunas.' : 'Menunggu Validasi.'),
                'order' => $order->fresh()->load(['user', 'canteen', 'courier', 'items.product'])
            ]);
        });
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

            // Physically delete the file from storage
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
}
