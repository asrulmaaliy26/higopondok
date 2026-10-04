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
$dbOrders = Order::forRecap()->filterPeriod('day', $date, $date)
    ->with(['user', 'canteen'])
    ->orderBy('id', 'asc')
    ->get();

echo "=== DAFTAR SEMUA 64 ORDER DI DATABASE (URUT ID ASC) ===\n";
foreach ($dbOrders as $idx => $o) {
    $santri = $o->user ? ($o->user->santri_name ?: $o->user->name) : '-';
    $kantin = $o->canteen ? $o->canteen->name : '-';
    echo sprintf("#%-4d | Jam %-8s | Rp %-7s | Kantin: %-25s | Santri: %s\n", 
        $o->id, 
        $o->created_at->format('H:i:s'), 
        number_format($o->total_price, 0, ',', '.'),
        substr($kantin, 0, 25),
        $santri
    );
}

// Balikkan CSV list agar urut dari transaksi paling pagi ke paling malam
$csvListAsc = array_reverse($csvList);

echo "\n=== DAFTAR SEMUA 64 TRANSAKSI GOPAY (URUT WAKTU ASC) ===\n";
foreach ($csvListAsc as $idx => $c) {
    echo sprintf("%-2d | Jam %-21s | Rp %-7s | Ref: %s\n", 
        $idx + 1, 
        $c['waktu'], 
        number_format($c['harga'], 0, ',', '.'),
        $c['ref']
    );
}
