<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$columns = Illuminate\Support\Facades\Schema::getColumnListing('orders');
echo "ORDERS:\n";
print_r($columns);

echo "ORDER_ITEMS:\n";
print_r(Illuminate\Support\Facades\Schema::getColumnListing('order_items'));

