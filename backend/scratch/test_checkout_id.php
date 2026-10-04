<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$order = App\Domains\Canteen\Order::first();
echo "Order #{$order->id} checkout_id: " . ($order->checkout_id ?? 'NULL') . "\n";

// Test updating checkout_id
$order->update(['checkout_id' => 'CHK-TEST-123']);
echo "Updated checkout_id: " . $order->fresh()->checkout_id . "\n";
