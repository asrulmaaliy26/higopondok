<?php

$csvFile = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/Laporan Transaksi GoPay 20260901 - 20260911.csv';
$rows = array_map('str_getcsv', file($csvFile));
$header = array_shift($rows);

echo "Total Baris di CSV: " . count($rows) . "\n";
$first = reset($rows);
$last = end($rows);

echo "Transaksi Pertama di CSV: " . $first[1] . " | " . $first[3] . " | Rp " . $first[6] . "\n";
echo "Transaksi Terakhir di CSV: " . $last[1] . " | " . $last[3] . " | Rp " . $last[6] . "\n";

// Cek apakah ada status selain SUKSES di CSV
$statuses = [];
foreach ($rows as $r) {
    if (empty($r) || count($r) < 7) continue;
    $statuses[$r[3]] = ($statuses[$r[3]] ?? 0) + 1;
}
echo "Status di CSV:\n";
print_r($statuses);
