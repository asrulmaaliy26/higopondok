<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Domains\Canteen\Order;
use Illuminate\Support\Facades\DB;

DB::beginTransaction();
try {
    // 1. Update standard base orders (3.500 delivery_fee & 1.500 admin_fee -> 3.000 & 2.000)
    $updatedStandard = Order::where('delivery_fee', 3500)
        ->where('admin_fee', 1500)
        ->update([
            'delivery_fee' => 3000,
            'admin_fee' => 2000,
        ]);
    
    // 2. Update orders with extra blocks where delivery_fee had base 3.500 (e.g. 6.500 -> 6.000, 15.500 -> 15.000)
    $updatedExtra6500 = Order::where('delivery_fee', 6500)
        ->where('admin_fee', 1500)
        ->update([
            'delivery_fee' => 6000,
            'admin_fee' => 2000,
        ]);

    $updatedExtra15500 = Order::where('delivery_fee', 15500)
        ->where('admin_fee', 1500)
        ->update([
            'delivery_fee' => 15000,
            'admin_fee' => 2000,
        ]);

    $updatedSolo3500 = Order::where('delivery_fee', 3500)
        ->where('admin_fee', 0)
        ->update([
            'delivery_fee' => 3000,
        ]);

    DB::commit();

    echo "Successfully updated orders to Opsi B (Ongkir 3.000):\n";
    echo "  - Standard orders (3.500/1.500 -> 3.000/2.000): {$updatedStandard} rows\n";
    echo "  - Extra 6.500 orders: {$updatedExtra6500} rows\n";
    echo "  - Extra 15.500 orders: {$updatedExtra15500} rows\n";
    echo "  - Zero admin 3.500 orders: {$updatedSolo3500} rows\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "Error updating orders: " . $e->getMessage() . "\n";
}
