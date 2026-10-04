<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$cancelled = Order::whereDate('created_at', '2026-09-10')->where('status', 'cancelled')->get();
echo "=== 16 PESANAN YANG DIBATALKAN (CANCELLED) ===\n";
foreach ($cancelled as $c) {
    echo "ID #{$c->id} | Rp " . number_format($c->total_price, 0, ',', '.') . " | Bayar: {$c->payment_status}\n";
}
