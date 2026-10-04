<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$date = '2026-09-10';

// Ambil semua order pada tanggal 10 September 2026 (tanpa filter apapun)
$allOrders = Order::withTrashed()->whereDate('created_at', $date)->get();

echo "=== BREAKDOWN SEMUA 80 PESANAN PADA 10 SEPTEMBER 2026 ===\n\n";

echo "1. STATUS PESANAN (status):\n";
$statusCounts = $allOrders->groupBy('status')->map->count();
foreach ($statusCounts as $st => $cnt) {
    echo "   - Status '$st' : $cnt pesanan\n";
}

echo "\n2. STATUS PEMBAYARAN (payment_status):\n";
$payStatusCounts = $allOrders->groupBy('payment_status')->map->count();
foreach ($payStatusCounts as $pst => $cnt) {
    echo "   - Payment Status '$pst' : $cnt pesanan\n";
}

echo "\n3. MATRIKS SILANG (Status Pesanan vs Status Bayar):\n";
$matrix = [];
foreach ($allOrders as $o) {
    $key = $o->status . " | " . $o->payment_status;
    $matrix[$key] = ($matrix[$key] ?? 0) + 1;
}
foreach ($matrix as $k => $cnt) {
    echo "   - $k : $cnt pesanan\n";
}

echo "\n4. STATUS DARI 64 PESANAN YANG ADA DI REKAP (forRecap):\n";
$recapOrders = Order::forRecap()->filterPeriod('day', $date, $date)->get();
$recapMatrix = [];
foreach ($recapOrders as $o) {
    $key = "Status: " . $o->status . " | Bayar: " . $o->payment_status;
    $recapMatrix[$key] = ($recapMatrix[$key] ?? 0) + 1;
}
foreach ($recapMatrix as $k => $cnt) {
    echo "   - $k : $cnt pesanan\n";
}

echo "\n";
