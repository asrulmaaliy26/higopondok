<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Auth\User;
use App\Domains\Canteen\Order;

echo "=== DAFTAR SEMUA AKUN KURIR ===\n";
$couriers = User::whereHas('roles', fn($q) => $q->where('name', 'kurir'))->get();
foreach ($couriers as $c) {
    echo "ID: {$c->id} | Name: {$c->name} | Email: {$c->email}\n";
}

echo "\n=== BREAKDOWN PESANAN TANGGAL 2026-09-12 ===\n";
$date = '2026-09-12';
$orders = Order::with(['user', 'canteen', 'courier', 'items.product'])
    ->whereIn('status', ['processing', 'completed'])
    ->whereDate('created_at', $date)
    ->get();

echo "Total orders valid (processing & completed): " . $orders->count() . "\n";

$byCourier = [];

foreach ($orders as $order) {
    $cId = $order->courier_id ?: 0;
    $cName = $order->courier ? $order->courier->name : 'Tanpa Kurir';

    if (!isset($byCourier[$cId])) {
        $byCourier[$cId] = [
            'name' => $cName,
            'orders' => [],
            'total_delivery_fee' => 0,
            'items' => [],
        ];
    }

    $byCourier[$cId]['orders'][] = $order;
    $byCourier[$cId]['total_delivery_fee'] += (float)$order->delivery_fee;

    foreach ($order->items as $item) {
        $pName = $item->product ? $item->product->name : ($order->custom_notes ?: 'Produk Khusus');
        $cantName = $order->canteen ? $order->canteen->name : '-';
        $byCourier[$cId]['items'][] = [
            'order_id' => $order->id,
            'canteen' => $cantName,
            'product' => $pName,
            'qty' => $item->quantity,
            'price' => $item->price,
            'subtotal' => $item->subtotal_amount,
        ];
    }

    if ($order->items->isEmpty() && $order->custom_notes) {
        $cantName = $order->canteen ? $order->canteen->name : '-';
        $byCourier[$cId]['items'][] = [
            'order_id' => $order->id,
            'canteen' => $cantName,
            'product' => 'Titip Beli: ' . $order->custom_notes,
            'qty' => 1,
            'price' => $order->total_price - $order->admin_fee - $order->delivery_fee,
            'subtotal' => $order->total_price - $order->admin_fee - $order->delivery_fee,
        ];
    }
}

foreach ($byCourier as $cId => $data) {
    echo "\n============================================\n";
    echo "KURIR: {$data['name']} (ID: {$cId})\n";
    echo "Jumlah Pesanan: " . count($data['orders']) . "\n";
    echo "Total Delivery Fee: Rp " . number_format($data['total_delivery_fee'], 0, ',', '.') . "\n";
    echo "Daftar Pesanan ID: " . implode(', ', array_map(fn($o) => "#" . $o->id, $data['orders'])) . "\n";
    echo "\nList Produk / Titipan yang Diantar:\n";
    foreach ($data['items'] as $it) {
        echo "- [ORD #{$it['order_id']} | {$it['canteen']}] {$it['product']} x{$it['qty']} (Rp " . number_format($it['subtotal'], 0, ',', '.') . ")\n";
    }
}

echo "\n=== CEK PESANAN UNTUK KURIR PAK EGA (ID 794) ===\n";
$egaUser = User::find(794);
if ($egaUser) {
    echo "ID: {$egaUser->id} | Name: {$egaUser->name} | Email: {$egaUser->email}\n";
    $canteenNames = $egaUser->assignedCanteens->pluck('name')->toArray();
    echo "Toko yang ditugaskan: " . (empty($canteenNames) ? 'BELUM ADA TOKO' : implode(', ', $canteenNames)) . "\n";
    $egaAllOrders = Order::with(['canteen', 'items.product'])->where('courier_id', 794)->get();
    echo "Total seluruh pesanan ID 794: " . $egaAllOrders->count() . "\n";
    foreach ($egaAllOrders as $eo) {
        $cName = $eo->canteen ? $eo->canteen->name : '-';
        echo "Order #{$eo->id} | Canteen: {$cName} | Status: {$eo->status} | Tanggal: {$eo->created_at} | Ongkir: {$eo->delivery_fee}\n";
    }
}

echo "\n=== DETAIL PESANAN DARI TOKO-TOKO PAK EGA ===\n";
$egaStoreOrders = Order::with(['canteen', 'items.product'])
    ->whereIn('status', ['processing', 'completed'])
    ->whereDate('created_at', '2026-09-12')
    ->whereHas('canteen', function($q) use ($egaUser) {
        $q->whereIn('id', $egaUser->assignedCanteens->pluck('id'));
    })
    ->get();

echo "Total pesanan dari toko Pak Ega di 12 Sept: " . $egaStoreOrders->count() . "\n";
$egaPotentialFee = 0;
foreach ($egaStoreOrders as $eso) {
    echo "Order #{$eso->id} | Toko: {$eso->canteen->name} | Courier saat ini: ID {$eso->courier_id} | Ongkir: Rp " . number_format($eso->delivery_fee, 0, ',', '.') . "\n";
    $egaPotentialFee += (float)$eso->delivery_fee;
    foreach ($eso->items as $it) {
        echo "   - {$it->product->name} x{$it->quantity} (Rp " . number_format($it->subtotal_amount, 0, ',', '.') . ")\n";
    }
    if ($eso->items->isEmpty() && $eso->custom_notes) {
        echo "   - Titip Beli: {$eso->custom_notes}\n";
    }
}
echo "Total Ongkir dari Toko Pak Ega: Rp " . number_format($egaPotentialFee, 0, ',', '.') . "\n";


