<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$all = Order::withTrashed()->whereDate('created_at', '2026-09-10')->get();
$trashed = Order::onlyTrashed()->whereDate('created_at', '2026-09-10')->get();
$cancelled = Order::whereDate('created_at', '2026-09-10')->where('status', 'cancelled')->get();

echo "Total orders (termasuk trashed): " . $all->count() . "\n";
echo "Total trashed (sampah): " . $trashed->count() . "\n";
echo "Total cancelled: " . $cancelled->count() . "\n";
echo "Total aktif / paid: " . ($all->count() - $trashed->count() - $cancelled->count()) . "\n";
