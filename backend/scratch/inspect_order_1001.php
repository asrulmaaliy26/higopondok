<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;

$order = Order::with(['items.product', 'user', 'canteen'])->find(1001);

echo "=== DETAIL ORDER #1001 ===\n";
echo "ID: " . $order->id . "\n";
echo "Checkout ID: " . $order->checkout_id . "\n";
echo "User: " . ($order->user ? $order->user->name : '-') . " (Santri: " . ($order->user ? $order->user->santri_name : '-') . ")\n";
echo "Kantin: " . ($order->canteen ? $order->canteen->name : '-') . "\n";
echo "Waktu Dibuat: " . $order->created_at . "\n";
echo "Total Price: Rp " . number_format($order->total_price, 0, ',', '.') . "\n";
echo "Admin Fee: Rp " . number_format($order->admin_fee, 0, ',', '.') . "\n";
echo "Delivery Fee: Rp " . number_format($order->delivery_fee, 0, ',', '.') . "\n";
echo "Items Subtotal: Rp " . number_format($order->products_subtotal, 0, ',', '.') . "\n";
echo "Items:\n";
foreach ($order->items as $i) {
    echo "  - " . ($i->product ? $i->product->name : 'Unknown') . " (Qty: {$i->quantity}, Price: Rp " . number_format($i->price, 0, ',', '.') . ", Subtotal: Rp " . number_format($i->subtotal, 0, ',', '.') . ", HPP: Rp " . number_format($i->hpp, 0, ',', '.') . ")\n";
}
echo "Bukti Pembayaran: " . json_encode($order->proof_of_payment) . "\n";

// Sekarang cari di CSV GoPay transaksi sekitar jam 17:00 - 18:00 (atau jam 10:00 - 11:00 UTC)
$csvFile = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/Laporan Transaksi GoPay 20260910 - 20260910.csv';
$rows = array_map('str_getcsv', file($csvFile));
$header = array_shift($rows);

echo "\n=== TRANSAKSI GOPAY SEKITAR JAM 16:00 - 17:30 (WIB / Kolom 1): ===\n";
foreach ($rows as $r) {
    if (empty($r) || count($r) < 7) continue;
    $time = $r[1]; // misal "10 Sep 2026 - 16:28:09"
    $amt = $r[6];
    $ref = $r[5];
    echo "  • Waktu: $time | Ref: $ref | Jumlah: Rp " . number_format((float)$amt, 0, ',', '.') . "\n";
}
