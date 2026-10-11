<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Domains\Canteen\Order;
use Illuminate\Support\Facades\DB;

$dates = Order::whereBetween('created_at', ['2026-10-01', '2026-10-10 23:59:59'])
    ->selectRaw('DATE(created_at) as dt')
    ->distinct()
    ->orderBy('dt')
    ->pluck('dt');

echo "=== SINKRONISASI DATABASE ORDERS MENURUT SKEMA BARU ===\n";

$totalUpdated = 0;

DB::beginTransaction();
try {
    foreach ($dates as $date) {
        $orders = Order::whereDate('created_at', $date)
            ->whereIn('status', ['pending', 'processing', 'completed'])
            ->orderBy('id', 'asc')
            ->get();

        $canteenOrderCounts = [];

        foreach ($orders as $order) {
            $cId = $order->canteen_id;

            if (!isset($canteenOrderCounts[$cId])) {
                $canteenOrderCounts[$cId] = 0;
            }

            $canteenOrderCounts[$cId]++;
            $orderIndex = $canteenOrderCounts[$cId];

            $qty = max(1, (int) $order->items->sum('quantity'));
            $rankedFees = Order::calculateUserRankedFees($qty, $orderIndex);

            $delFee = (float) $rankedFees['delivery_fee'];
            $admFee = (float) $rankedFees['admin_fee'];

            // Jika ada voucher diskon delivery fee
            $voucherDisc = (float) ($order->voucher_discount ?? 0);
            if ($voucherDisc > 0 && optional($order->voucher)->discount_type === 'delivery_fee') {
                $delFee = max(0, $delFee - $voucherDisc);
            }

            $hpj = $order->products_subtotal;
            $newTotal = $hpj + $delFee + $admFee;

            // Update baris order di database
            $order->update([
                'delivery_fee' => $delFee,
                'admin_fee'    => $admFee,
                'total_price'  => $newTotal,
            ]);

            $totalUpdated++;
        }
    }

    DB::commit();
    echo "BERHASIL mengupdate {$totalUpdated} pesanan di database!\n";
} catch (\Throwable $e) {
    DB::rollBack();
    echo "GAGAL: " . $e->getMessage() . "\n";
}
