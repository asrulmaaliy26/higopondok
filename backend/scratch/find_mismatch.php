<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$csvFile = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/Laporan Transaksi GoPay 20260910 - 20260910.csv';
$rows = array_map('str_getcsv', file($csvFile));
$header = array_shift($rows);

$csvCounts = [];
foreach ($rows as $row) {
    if (empty($row) || count($row) < 7) continue;
    $amount = (int) $row[6];
    $csvCounts[$amount] = ($csvCounts[$amount] ?? 0) + 1;
}

$date = '2026-09-10';
$dbOrders = Order::forRecap()
    ->filterPeriod('day', $date, $date)
    ->with(['user', 'canteen'])
    ->get();

$dbCounts = [];
foreach ($dbOrders as $o) {
    $amount = (int) $o->total_price;
    $dbCounts[$amount] = ($dbCounts[$amount] ?? 0) + 1;
}

$allAmounts = array_unique(array_merge(array_keys($csvCounts), array_keys($dbCounts)));
sort($allAmounts);

echo sprintf("%-15s | %-12s | %-12s | %-10s\n", "Nominal", "GoPay (CSV)", "Database", "Status");
echo str_repeat("-", 60) . "\n";

foreach ($allAmounts as $amt) {
    $cCount = $csvCounts[$amt] ?? 0;
    $dCount = $dbCounts[$amt] ?? 0;
    $status = ($cCount === $dCount) ? "COCOK ✅" : "BEDA ❌ (Selisih: " . ($cCount - $dCount) . ")";
    echo sprintf("Rp %-12s | %-12d | %-12d | %s\n", number_format($amt, 0, ',', '.'), $cCount, $dCount, $status);
}

// Lihat order di DB yang nominalnya beda
echo "\n=== DETAIL TRANSAKSI YANG BEDA ===\n";
foreach ($dbOrders as $o) {
    $amt = (int) $o->total_price;
    $cCount = $csvCounts[$amt] ?? 0;
    $dCount = $dbCounts[$amt] ?? 0;
    if ($cCount !== $dCount) {
        $cName = $o->canteen ? $o->canteen->name : "-";
        $uName = $o->user ? ($o->user->santri_name ?: $o->user->name) : "-";
        $createdAt = $o->created_at->format('H:i:s');
        echo "Order #{$o->id} | Jam {$createdAt} | Kantin: {$cName} | Santri: {$uName} | Total: Rp " . number_format($amt, 0, ',', '.') . " (Status: {$o->status}, Bayar: {$o->payment_status})\n";
    }
}
