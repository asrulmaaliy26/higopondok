<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\OrderItem;
use App\Domains\Canteen\Product;
use App\Domains\Auth\User;
use Illuminate\Support\Facades\DB;

echo "=== AUDIT LOGIKA HIGO PONDOK ===\n\n";

$passCount = 0;
$failCount = 0;

function assertCondition($name, $condition, $details = '') {
    global $passCount, $failCount;
    if ($condition) {
        echo "  ✅ PASS | $name\n";
        $passCount++;
    } else {
        echo "  ❌ FAIL | $name : $details\n";
        $failCount++;
    }
}

// 1. Uji Pricing Config Opsi B
$cfg = Order::getPricingConfig();
assertCondition("Pricing Config Base Delivery", $cfg['base_delivery_fee'] == 3000, "Got: " . $cfg['base_delivery_fee']);
assertCondition("Pricing Config Base Admin", $cfg['base_admin_fee'] == 2000, "Got: " . $cfg['base_admin_fee']);
assertCondition("Pricing Config Cut", $cfg['user_threshold_courier_cut'] == 2000, "Got: " . $cfg['user_threshold_courier_cut']);

// 2. Uji Kalkulasi Tarif Standar & Kelipatan
$fee1 = Order::calculateOrderFees(3);
assertCondition("Fee 3 items delivery", $fee1['delivery_fee'] == 3000);
assertCondition("Fee 3 items admin", $fee1['admin_fee'] == 2000);

$fee7 = Order::calculateOrderFees(7); // 1 extra block (+2000 kurir, +3000 admin)
assertCondition("Fee 7 items delivery (extra block)", $fee7['delivery_fee'] == 5000);
assertCondition("Fee 7 items admin (extra block)", $fee7['admin_fee'] == 5000);

// 3. Uji Ranked Fees (User 1-3 vs User 4+)
$rankUser1 = Order::calculateUserRankedFees(3, 1);
assertCondition("User 1 Kurir (tanpa potong)", $rankUser1['delivery_fee'] == 3000);
assertCondition("User 1 Admin (pokok)", $rankUser1['admin_fee'] == 2000);

$rankUser4 = Order::calculateUserRankedFees(3, 4);
assertCondition("User 4 Kurir (potong 2000)", $rankUser4['delivery_fee'] == 1000, "Got: " . $rankUser4['delivery_fee']);
assertCondition("User 4 Admin (+2000)", $rankUser4['admin_fee'] == 4000, "Got: " . $rankUser4['admin_fee']);
assertCondition("User 4 Total Jasa Tetap 5000", ($rankUser4['delivery_fee'] + $rankUser4['admin_fee']) == 5000);

// 4. Uji Aksesor Canteen Income (Laba Bersih HPJ - HPP)
$order = Order::with('items.product')->whereHas('items')->first();
if ($order) {
    $expectedProfit = $order->products_subtotal - $order->hpp;
    $expectedIncome = $order->courier_id ? $expectedProfit : ($expectedProfit + $order->delivery_fee);
    assertCondition("Aksesor canteen_income (HPJ - HPP)", abs($order->canteen_income - $expectedIncome) < 0.01, "Income: {$order->canteen_income}, Expected: {$expectedIncome}");
}

// 5. Uji Canteen is_open Accessor
$canteen = Canteen::first();
if ($canteen) {
    assertCondition("Canteen is_open boolean type", is_bool($canteen->is_open));
}

echo "\nHASIL AUDIT: $passCount LULUS, $failCount GAGAL\n";
