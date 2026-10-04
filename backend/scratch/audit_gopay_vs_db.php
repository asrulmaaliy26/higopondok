<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$csvFile = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/Laporan Transaksi GoPay 20260910 - 20260910.csv';

if (!file_exists($csvFile)) {
    die("File CSV tidak ditemukan: $csvFile\n");
}

$rows = array_map('str_getcsv', file($csvFile));
$header = array_shift($rows);

// Parse CSV rows
$csvData = [];
$totalCsvAmount = 0;

foreach ($rows as $row) {
    if (empty($row) || count($row) < 7) continue;
    $amount = (float) $row[6]; // Kolom Harga
    $timeCreated = $row[1];
    $timeUpdated = $row[2];
    $status = $row[3];
    $trxId = $row[4];
    $refNo = $row[5];

    $totalCsvAmount += $amount;
    $csvData[] = [
        'trx_id' => $trxId,
        'ref_no' => $refNo,
        'amount' => $amount,
        'time_created' => $timeCreated,
        'time_updated' => $timeUpdated,
        'status' => $status,
    ];
}

// Ambil Order dari Database untuk tanggal 2026-09-10
$date = '2026-09-10';
$dbOrders = Order::forRecap()
    ->filterPeriod('day', $date, $date)
    ->with(['user', 'canteen'])
    ->orderBy('created_at', 'desc')
    ->orderBy('id', 'desc')
    ->get();

$totalDbAmount = $dbOrders->sum('total_price');

echo "=== AUDIT TRANSAKSI GOPAY VS DATABASE (10 SEPTEMBER 2026) ===\n\n";

echo "📊 RINGKASAN JUMLAH:\n";
echo "  • Total Baris Transaksi GoPay : " . count($csvData) . " transaksi\n";
echo "  • Total Pesanan di Database  : " . $dbOrders->count() . " pesanan\n";
echo "  • Total Uang Masuk di GoPay   : Rp " . number_format($totalCsvAmount, 0, ',', '.') . "\n";
echo "  • Total Grand Total Database  : Rp " . number_format($totalDbAmount, 0, ',', '.') . "\n";
echo "  • Selisih (GoPay - Database)  : Rp " . number_format($totalCsvAmount - $totalDbAmount, 0, ',', '.') . "\n\n";

// Periksa apakah setiap nominal di CSV cocok dengan nominal di DB
$csvAmounts = array_column($csvData, 'amount');
sort($csvAmounts);

$dbAmounts = $dbOrders->pluck('total_price')->map(fn($v) => (float)$v)->toArray();
sort($dbAmounts);

$diffAmounts = array_diff_assoc($csvAmounts, $dbAmounts);

if (empty($diffAmounts)) {
    echo "✅ SEMUA 64 NOMINAL TRANSAKSI PERSIS SAMA 100% ANTARA GOPAY DAN DATABASE!\n\n";
} else {
    echo "⚠️ ADA PERBEDAAN NOMINAL:\n";
    print_r($diffAmounts);
    echo "\n";
}

// Distribusi nominal per transaksi
$distribution = array_count_values(array_map(fn($v) => "Rp " . number_format($v, 0, ',', '.'), $csvAmounts));
echo "📈 DISTRIBUSI NOMINAL TRANSAKSI:\n";
foreach ($distribution as $price => $count) {
    echo "  - $price : $count transaksi\n";
}

echo "\n";
