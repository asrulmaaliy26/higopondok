<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;
use Carbon\Carbon;

$startDate = '2026-09-01';
$endDate = '2026-09-11';

// Cek semua order termasuk cancelled
$allOrders = Order::withTrashed()
    ->whereBetween('created_at', [
        Carbon::parse($startDate)->startOfDay(),
        Carbon::parse($endDate)->endOfDay()
    ])
    ->get();

echo "=== STATUS SEMUA PESANAN 1 - 11 SEPTEMBER DI DB ===\n";
echo "Total Pesanan Masuk : " . $allOrders->count() . "\n";
echo "  - Completed : " . $allOrders->where('status', 'completed')->count() . "\n";
echo "  - Processing: " . $allOrders->where('status', 'processing')->count() . "\n";
echo "  - Pending   : " . $allOrders->where('status', 'pending')->count() . "\n";
echo "  - Cancelled : " . $allOrders->where('status', 'cancelled')->count() . "\n";

echo "\nStatus Bayar di DB:\n";
echo "  - Paid                  : " . $allOrders->where('payment_status', 'paid')->count() . "\n";
echo "  - Waiting Confirmation  : " . $allOrders->where('payment_status', 'waiting_confirmation')->count() . "\n";
echo "  - Unpaid                : " . $allOrders->where('payment_status', 'unpaid')->count() . "\n";

// Apakah ada order cancelled yang payment_status = paid?
$cancelledPaid = $allOrders->where('status', 'cancelled')->where('payment_status', 'paid');
echo "\nOrder Cancelled TAPI Paid: " . $cancelledPaid->count() . " pesanan\n";
foreach ($cancelledPaid as $cp) {
    echo "  #{$cp->id} | {$cp->created_at} | Rp " . number_format($cp->total_price, 0, ',', '.') . "\n";
}

// Apakah ada order pending/processing/completed yang payment_status = unpaid?
$activeUnpaid = $allOrders->whereIn('status', ['pending', 'processing', 'completed'])->where('payment_status', '!=', 'paid');
echo "\nOrder Aktif TAPI Unpaid: " . $activeUnpaid->count() . " pesanan\n";
foreach ($activeUnpaid as $au) {
    echo "  #{$au->id} | {$au->created_at} | Rp " . number_format($au->total_price, 0, ',', '.') . " | Status: {$au->status}, Pay: {$au->payment_status}\n";
}
