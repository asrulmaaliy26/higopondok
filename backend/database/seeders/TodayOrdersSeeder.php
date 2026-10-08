<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use App\Domains\Canteen\CanteenBalanceLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TodayOrdersSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ambil seluruh kantin yang memiliki produk
        $canteens = Canteen::has('products')->with('products')->get();
        if ($canteens->isEmpty()) {
            $this->command->error("Tidak ada kantin dengan produk.");
            return;
        }

        // 2. Ambil user santri / wali
        $users = User::whereHas('roles', fn($q) => $q->where('name', 'user'))
            ->whereNotNull('santri_name')
            ->where('santri_name', '!=', '')
            ->get();

        if ($users->isEmpty()) {
            $users = User::whereHas('roles', fn($q) => $q->where('name', 'user'))->take(10)->get();
        }

        // 3. Ambil kurir
        $couriers = User::whereHas('roles', fn($q) => $q->where('name', 'kurir'))->get();
        $courierIds = $couriers->pluck('id')->toArray();
        if (empty($courierIds)) {
            $courierIds = [null];
        }

        $sampleNotes = [
            "Level 2 pedas sedang, es teh manis sedikit es",
            "Jangan pakai daun bawang dan seledri",
            "Minta kuah dipisah di plastik ya",
            "Bungkus plastik double agar tidak tumpah",
            "Pedas manis mantap",
            "Es batu sedikit saja",
            "Minta sambal ekstra dipisah",
            "Tolong sendok dan garpu",
            "Saus kecap manis banyakin",
            "Dimsum saus asam manis",
        ];

        $sampleCustomNotes = [
            "Titipkan di pos satpam jika sedang tadarus.",
            "Tolong diantar ke kamar sebelum waktu ashar ya kak.",
            "Titip di depan kamar jika sedang mengaji.",
            "Mohon kabari via WA bila sudah dekat asrama.",
            "Pesanan untuk berbuka puasa sunnah, terima kasih!",
            "Titip ke teman sekamar jika saya di masjid."
        ];

        $rooms = [
            "Al Majid 1", "Al Majid 2", "Al Majid 3", "AL MALIK", "Kamar 12",
            "ASMAH", "Asmah/G1", "Sunan Giri 4", "Gedung B R.05"
        ];

        // Status distribution: ~10 pending, ~12 processing, ~20 completed, ~3 cancelled
        $targetOrders = [
            ['status' => 'pending', 'payment' => 'paid', 'count' => 8],
            ['status' => 'pending', 'payment' => 'unpaid', 'count' => 4],
            ['status' => 'processing', 'payment' => 'paid', 'count' => 12],
            ['status' => 'completed', 'payment' => 'paid', 'count' => 20],
            ['status' => 'cancelled', 'payment' => 'unpaid', 'count' => 3],
        ];

        DB::beginTransaction();
        try {
            $createdCount = 0;
            $today = Carbon::today('Asia/Jakarta');

            foreach ($targetOrders as $target) {
                for ($k = 0; $k < $target['count']; $k++) {
                    $user = $users->random();
                    $canteen = $canteens->random();
                    $products = $canteen->products;
                    if ($products->isEmpty()) continue;

                    $courierId = !empty($courierIds) ? $courierIds[array_rand($courierIds)] : null;

                    // Jam dibuat hari ini (antara 07:00 pagi sampai sekarang)
                    $hour = rand(7, 18);
                    $minute = rand(0, 59);
                    $orderTime = $today->copy()->setTime($hour, $minute, rand(0, 59));
                    if ($orderTime->isFuture()) {
                        $orderTime = now('Asia/Jakarta')->subMinutes(rand(5, 120));
                    }

                    $status = $target['status'];
                    $paymentStatus = $target['payment'];

                    $isKota = strtolower($canteen->category ?? 'kauman') === 'kota';
                    $checkoutId = 'CHK-' . $today->format('Ymd') . '-' . strtoupper(Str::random(6));

                    // Sample proofs
                    $userName = strtolower(str_replace(' ', '_', $user->santri_name ?: $user->name));
                    $userName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userName) ?: 'user';
                    $hasPaymentProof = ($paymentStatus === 'paid' || $status === 'completed');
                    $hasPurchaseProof = ($status === 'processing' || $status === 'completed');
                    $hasDeliveryProof = ($status === 'completed');

                    $proofPayment = $hasPaymentProof ? ["orders/{$userName}/proof_payment.jpg"] : null;
                    $proofPurchase = $hasPurchaseProof ? ["orders/{$userName}/proof_struk.jpg"] : null;
                    $proofDelivery = $hasDeliveryProof ? ["orders/{$userName}/proof_delivery.jpg"] : null;

                    $order = Order::create([
                        'checkout_id' => $checkoutId,
                        'user_id' => $user->id,
                        'canteen_id' => $canteen->id,
                        'courier_id' => $courierId,
                        'is_custom' => false,
                        'custom_notes' => $sampleCustomNotes[array_rand($sampleCustomNotes)],
                        'status' => $status,
                        'payment_status' => $paymentStatus,
                        'proof_of_payment' => $proofPayment,
                        'proof_of_purchase' => $proofPurchase,
                        'proof_of_delivery' => $proofDelivery,
                        'total_price' => 0,
                        'admin_fee' => 2000,
                        'delivery_fee' => 3000,
                        'delivery_location' => $user->santri_room ?: $rooms[array_rand($rooms)],
                        'is_courier_paid_by_canteen' => ($status === 'completed'),
                        'created_at' => $orderTime,
                        'updated_at' => $orderTime,
                    ]);

                    // Buat 1 sampai 3 item produk untuk pesanan ini
                    $itemCount = rand(1, 3);
                    $subtotalItems = 0;
                    $totalQty = 0;

                    $selectedProducts = $products->random(min($itemCount, $products->count()));
                    foreach ($selectedProducts as $prod) {
                        $qty = rand(1, 2);
                        $price = (float) ($prod->discount_price ?: $prod->price);
                        $sub = $price * $qty;

                        OrderItem::create([
                            'order_id' => $order->id,
                            'product_id' => $prod->id,
                            'quantity' => $qty,
                            'price' => $price,
                            'subtotal' => $sub,
                            'notes' => (rand(0, 1) === 1) ? $sampleNotes[array_rand($sampleNotes)] : null,
                            'created_at' => $orderTime,
                            'updated_at' => $orderTime,
                        ]);

                        $subtotalItems += $sub;
                        $totalQty += $qty;
                    }

                    // Hitung tarif resmi HiGO Pondok
                    $feeCalc = Order::calculateOrderFees($totalQty);
                    $delFee = $feeCalc['delivery_fee'] ?? 3000.0;
                    $admFee = $feeCalc['admin_fee'] ?? 2000.0;
                    $grandTotal = $subtotalItems + $delFee + $admFee;

                    $order->update([
                        'total_price' => $grandTotal,
                        'delivery_fee' => $delFee,
                        'admin_fee' => $admFee,
                    ]);

                    // Jika pesanan completed dan paid, tambahkan saldo kantin dan saldo kurir secara resmi
                    if ($status === 'completed' && $paymentStatus === 'paid') {
                        $canteenNet = $subtotalItems;
                        CanteenBalanceLedger::record(
                            $canteen,
                            'in',
                            $canteenNet,
                            "Penjualan Pesanan #{$order->id} ({$totalQty} item)",
                            $order->id
                        );
                        $canteen->increment('balance', $canteenNet);

                        if ($courierId && $delFee > 0) {
                            $courier = User::find($courierId);
                            if ($courier) {
                                $courier->increment('balance', $delFee);
                            }
                        }
                    }

                    $createdCount++;
                }
            }

            // =========================================================================
            // KHUSUS: DUMMY PESANAN MELIMPAH MIE GACOAN DENGAN BERBAGAI TINGKAT KEPEDASAN
            // =========================================================================
            $gacoanCanteen = Canteen::where('name', 'like', '%Gacoan%')->first();
            if ($gacoanCanteen) {
                // Pastikan produk-produk Gacoan memiliki kategori standar (Makanan, Camilan, Minuman)
                $prodMieGacoan = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Mie Gacoan'],
                    ['price' => 13000, 'hpj' => 13000, 'hpp' => 11000, 'stock' => 100, 'is_available' => 1, 'category' => 'Makanan']
                );
                $prodMieGacoan->update(['category' => 'Makanan', 'price' => 13000]);

                $prodMieHompimpa = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Mie Hompimpa'],
                    ['price' => 13000, 'hpj' => 13000, 'hpp' => 11000, 'stock' => 100, 'is_available' => 1, 'category' => 'Makanan']
                );
                $prodMieHompimpa->update(['category' => 'Makanan', 'price' => 13000]);

                $prodMieSuit = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Mie Suit'],
                    ['price' => 13000, 'hpj' => 13000, 'hpp' => 11000, 'stock' => 100, 'is_available' => 1, 'category' => 'Makanan']
                );
                $prodMieSuit->update(['category' => 'Makanan', 'price' => 13000]);

                $prodPangsit = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Pangsit Goreng'],
                    ['price' => 12000, 'hpj' => 12000, 'hpp' => 10000, 'stock' => 100, 'is_available' => 1, 'category' => 'Camilan']
                );
                $prodPangsit->update(['category' => 'Camilan', 'price' => 12000]);

                $prodUdangKeju = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Udang Keju'],
                    ['price' => 12000, 'hpj' => 12000, 'hpp' => 10000, 'stock' => 100, 'is_available' => 1, 'category' => 'Camilan']
                );
                $prodUdangKeju->update(['category' => 'Camilan', 'price' => 12000]);

                $prodUdangRambutan = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Udang Rambutan'],
                    ['price' => 12000, 'hpj' => 12000, 'hpp' => 10000, 'stock' => 100, 'is_available' => 1, 'category' => 'Camilan']
                );
                $prodUdangRambutan->update(['category' => 'Camilan', 'price' => 12000]);

                $prodIceTea = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Ice Tea'],
                    ['price' => 6000, 'hpj' => 6000, 'hpp' => 4500, 'stock' => 100, 'is_available' => 1, 'category' => 'Minuman']
                );
                $prodIceTea->update(['category' => 'Minuman', 'price' => 6000]);

                $prodMilo = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Milo'],
                    ['price' => 11000, 'hpj' => 11000, 'hpp' => 9000, 'stock' => 100, 'is_available' => 1, 'category' => 'Minuman']
                );
                $prodMilo->update(['category' => 'Minuman', 'price' => 11000]);

                $prodEsGenderuwo = Product::firstOrCreate(
                    ['canteen_id' => $gacoanCanteen->id, 'name' => 'Es Genderuwo'],
                    ['price' => 9000, 'hpj' => 9000, 'hpp' => 7000, 'stock' => 100, 'is_available' => 1, 'category' => 'Minuman']
                );
                $prodEsGenderuwo->update(['category' => 'Minuman', 'price' => 9000]);

                // Pola Pesanan Gacoan dengan variasi level kepedasan
                $gacoanOrdersConfig = [
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 3, 'notes' => 'Level 1 (Pedas Sedang)'],
                            ['prod' => $prodIceTea, 'qty' => 2, 'notes' => 'Sedikit Es, Manis'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 4, 'notes' => 'Level 2 (Pedas Mantap)'],
                            ['prod' => $prodUdangKeju, 'qty' => 2, 'notes' => 'Saus Dipisah'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 2, 'notes' => 'Level 2 (Pedas Mantap)'],
                            ['prod' => $prodMieHompimpa, 'qty' => 2, 'notes' => 'Level 1 (Pedas Sedang)'],
                            ['prod' => $prodEsGenderuwo, 'qty' => 2, 'notes' => 'Normal'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 5, 'notes' => 'Level 3 (Extra Pedas)'],
                            ['prod' => $prodPangsit, 'qty' => 3, 'notes' => 'Bungkus rapi'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 3, 'notes' => 'Level 4 (Super Pedas)'],
                            ['prod' => $prodMilo, 'qty' => 2, 'notes' => 'Dingin'],
                        ]
                    ],
                    [
                        'status' => 'pending',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 4, 'notes' => 'Level 1 (Pedas Sedang)'],
                            ['prod' => $prodUdangRambutan, 'qty' => 2, 'notes' => 'Extra Saus'],
                        ]
                    ],
                    [
                        'status' => 'pending',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 3, 'notes' => 'Level 6 (Pedas Gila)'],
                            ['prod' => $prodIceTea, 'qty' => 3, 'notes' => 'Es Batu Banyak'],
                        ]
                    ],
                    [
                        'status' => 'pending',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 2, 'notes' => 'Level 8 (Pedas Maksimal)'],
                            ['prod' => $prodEsGenderuwo, 'qty' => 2, 'notes' => 'Manis Sedang'],
                        ]
                    ],
                    [
                        'status' => 'pending',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 5, 'notes' => 'Level 2 (Pedas Mantap)'],
                            ['prod' => $prodPangsit, 'qty' => 2, 'notes' => null],
                        ]
                    ],
                    [
                        'status' => 'completed',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 2, 'notes' => 'Level 3 (Extra Pedas)'],
                            ['prod' => $prodMieSuit, 'qty' => 2, 'notes' => 'Level 0 (Tidak Pedas / Ori)'],
                        ]
                    ],
                    [
                        'status' => 'completed',
                        'items' => [
                            ['prod' => $prodMieHompimpa, 'qty' => 3, 'notes' => 'Level 2 (Pedas Mantap)'],
                            ['prod' => $prodPangsit, 'qty' => 2, 'notes' => 'Saus Dipisah'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 3, 'notes' => 'Level 4 (Super Pedas)'],
                            ['prod' => $prodEsGenderuwo, 'qty' => 3, 'notes' => 'Sedikit Es'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 4, 'notes' => 'Level 1 (Pedas Sedang)'],
                            ['prod' => $prodIceTea, 'qty' => 2, 'notes' => 'Manis'],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 2, 'notes' => 'Level 6 (Pedas Gila)'],
                            ['prod' => $prodUdangKeju, 'qty' => 2, 'notes' => null],
                        ]
                    ],
                    [
                        'status' => 'processing',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 3, 'notes' => 'Level 2 (Pedas Mantap)'],
                            ['prod' => $prodMieGacoan, 'qty' => 2, 'notes' => 'Level 3 (Extra Pedas)'],
                        ]
                    ],
                    [
                        'status' => 'completed',
                        'items' => [
                            ['prod' => $prodMieGacoan, 'qty' => 1, 'notes' => 'Level 8 (Pedas Maksimal)'],
                            ['prod' => $prodMilo, 'qty' => 2, 'notes' => 'Dingin Sedikit Manis'],
                        ]
                    ],
                ];

                foreach ($gacoanOrdersConfig as $gOrder) {
                    $u = $users->random();
                    $cId = !empty($courierIds) ? $courierIds[array_rand($courierIds)] : null;
                    $status = $gOrder['status'];
                    $checkoutId = 'CHK-' . $today->format('Ymd') . '-GC-' . strtoupper(Str::random(5));
                    $orderTime = $today->copy()->setTime(rand(8, 17), rand(0, 59), rand(0, 59));

                    $uName = strtolower(str_replace(' ', '_', $u->santri_name ?: $u->name));
                    $uName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $uName) ?: 'user';

                    $order = Order::create([
                        'checkout_id' => $checkoutId,
                        'user_id' => $u->id,
                        'canteen_id' => $gacoanCanteen->id,
                        'courier_id' => $cId,
                        'is_custom' => false,
                        'custom_notes' => null,
                        'status' => $status,
                        'payment_status' => 'paid',
                        'proof_of_payment' => ["orders/{$uName}/proof_payment.jpg"],
                        'proof_of_purchase' => ($status === 'processing' || $status === 'completed') ? ["orders/{$uName}/proof_struk.jpg"] : null,
                        'proof_of_delivery' => ($status === 'completed') ? ["orders/{$uName}/proof_delivery.jpg"] : null,
                        'total_price' => 0,
                        'admin_fee' => 2000,
                        'delivery_fee' => 3000,
                        'delivery_location' => $u->santri_room ?: $rooms[array_rand($rooms)],
                        'is_courier_paid_by_canteen' => ($status === 'completed'),
                        'created_at' => $orderTime,
                        'updated_at' => $orderTime,
                    ]);

                    $subtotalItems = 0;
                    $totalQty = 0;

                    foreach ($gOrder['items'] as $itemData) {
                        $p = $itemData['prod'];
                        $qty = $itemData['qty'];
                        $price = (float) $p->price;
                        $sub = $price * $qty;

                        OrderItem::create([
                            'order_id' => $order->id,
                            'product_id' => $p->id,
                            'quantity' => $qty,
                            'price' => $price,
                            'subtotal' => $sub,
                            'notes' => $itemData['notes'],
                            'created_at' => $orderTime,
                            'updated_at' => $orderTime,
                        ]);

                        $subtotalItems += $sub;
                        $totalQty += $qty;
                    }

                    $feeCalc = Order::calculateOrderFees($totalQty);
                    $delFee = $feeCalc['delivery_fee'] ?? 3000.0;
                    $admFee = $feeCalc['admin_fee'] ?? 2000.0;
                    $grandTotal = $subtotalItems + $delFee + $admFee;

                    $order->update([
                        'total_price' => $grandTotal,
                        'delivery_fee' => $delFee,
                        'admin_fee' => $admFee,
                    ]);

                    if ($status === 'completed') {
                        CanteenBalanceLedger::record(
                            $gacoanCanteen,
                            'in',
                            $subtotalItems,
                            "Penjualan Pesanan Gacoan #{$order->id} ({$totalQty} item)",
                            $order->id
                        );
                        $gacoanCanteen->increment('balance', $subtotalItems);

                        if ($cId && $delFee > 0) {
                            $courier = User::find($cId);
                            if ($courier) {
                                $courier->increment('balance', $delFee);
                            }
                        }
                    }

                    $createdCount++;
                }
            }

            DB::commit();
            $this->command->info("BERHASIL: Menambahkan {$createdCount} dummy pesanan hari ini termasuk cluster pesanan Mie Gacoan!");

        } catch (\Exception $e) {
            DB::rollBack();
            $this->command->error("GAGAL: " . $e->getMessage() . " on line " . $e->getLine());
        }
    }
}
