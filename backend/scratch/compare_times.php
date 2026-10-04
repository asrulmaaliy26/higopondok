<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$csvFile = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/Laporan Transaksi GoPay 20260910 - 20260910.csv';
$rows = array_map('str_getcsv', file($csvFile));
$header = array_shift($rows);

$csvList = [];
foreach ($rows as $r) {
    if (empty($r) || count($r) < 7) continue;
    $csvList[] = [
        'waktu' => $r[1],
        'ref' => $r[5],
        'harga' => (int)$r[6],
        'toko' => $r[10],
    ];
}

$date = '2026-09-10';
$orders = Order::forRecap()->filterPeriod('day', $date, $date)
    ->with(['user', 'canteen'])
    ->orderBy('created_at', 'desc')
    ->get();

echo "=== PERBANDINGAN TRANSAKSI PER WAKTU ===\n";
echo "Total GoPay CSV: " . count($csvList) . "\n";
echo "Total DB Orders: " . $orders->count() . "\n\n";

// Urutkan kedua list berdasarkan waktu dari yang paling akhir ke awal
echo "Top 10 Order Terbaru di Database:\n";
foreach ($orders->take(10) as $o) {
    $santri = $o->user ? ($o->user->santri_name ?: $o->user->name) : '-';
    $kantin = $o->canteen ? $o->canteen->name : '-';
    echo "  DB #{$o->id} | {$o->created_at->format('H:i:s')} | Rp " . number_format($o->total_price, 0, ',', '.') . " | {$kantin} | {$santri}\n";
}

echo "\nTop 10 Transaksi Terbaru di GoPay:\n";
foreach (array_slice($csvList, 0, 10) as $c) {
    echo "  GoPay | {$c['waktu']} | Rp " . number_format($c['harga'], 0, ',', '.') . " | Ref: {$c['ref']}\n";
}
