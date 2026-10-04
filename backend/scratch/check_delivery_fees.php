<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Domains\Canteen\Order;

$dist = Order::selectRaw('delivery_fee, admin_fee, count(*) as count')->groupBy('delivery_fee', 'admin_fee')->get();
foreach ($dist as $d) {
    echo "delivery_fee: {$d->delivery_fee} | admin_fee: {$d->admin_fee} | count: {$d->count}\n";
}
