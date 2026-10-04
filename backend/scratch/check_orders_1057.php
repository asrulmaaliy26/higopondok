<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Domains\Canteen\Order;

$orders = Order::whereBetween('id', [1055, 1070])->get(['id', 'canteen_id', 'total_price', 'delivery_fee', 'admin_fee', 'created_at']);
foreach ($orders as $o) {
    echo "ID: {$o->id} | Created: {$o->created_at} | DeliveryFee in DB: {$o->delivery_fee} | AdminFee in DB: {$o->admin_fee} | Total: {$o->total_price}\n";
}
