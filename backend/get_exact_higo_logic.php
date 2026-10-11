<?php
$f2 = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/app/Domains/Canteen/Order.php';
$c2 = file_get_contents($f2);

function getExactCode($code, $startStr, $endStr) {
    $p1 = strpos($code, $startStr);
    $p2 = strpos($code, $endStr, $p1);
    return substr($code, $p1, $p2 - $p1);
}

echo "=== HIGO-PONDOK calculateUserRankedFees to getFinancialMetrics ===\n";
echo getExactCode($c2, "public static function calculateUserRankedFees(", "public static function getPricingConfig(): array");
