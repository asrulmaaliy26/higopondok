<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;
use App\Domains\Auth\User;
use App\Http\Controllers\Controller;

// Create dummy test controller instance
$testController = new class extends Controller {
    public function testPath($order, $proofType, $date = null) {
        return $this->getOrderProofUploadPath($order, $proofType, $date);
    }
};

$user = new User(['name' => 'Ahmad Zaki', 'santri_name' => 'Ahmad Zaki']);
$order = new Order();
$order->setRelation('user', $user);

$testDate = '2025-01-20'; // Senin, 20 Januari 2025

$pathPayment = $testController->testPath($order, 'proof', $testDate);
$pathDelivery = $testController->testPath($order, 'proff_delivery', $testDate);
$pathKantin = $testController->testPath($order, 'proff_kantin', $testDate);

echo "=== TEST PROOF PATH FORMAT ===\n";
echo "Proof Transfer/Payment : $pathPayment\n";
echo "Proof Delivery Kurir   : $pathDelivery\n";
echo "Proof Struk Kantin     : $pathKantin\n";

$isPaymentOk = ($pathPayment === 'senin20Januari2025/ahmad_zaki/proof');
$isDeliveryOk = ($pathDelivery === 'senin20Januari2025/ahmad_zaki/proff_delivery');
$isKantinOk = ($pathKantin === 'senin20Januari2025/ahmad_zaki/proff_kantin');

if ($isPaymentOk && $isDeliveryOk && $isKantinOk) {
    echo "\n✅ SEMUA FORMAT TEPAT 100% SESUAI CONTOH USER!\n";
} else {
    echo "\n❌ ADA KETIDAKSESUAIAN FORMAT!\n";
}
