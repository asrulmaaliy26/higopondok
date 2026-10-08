<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\UserVoucher;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class TokoBarokahTestingSeeder extends Seeder
{
    public function run(): void
    {
        $today = Carbon::now('Asia/Jakarta');

        // 1. Dapatkan atau Buat Toko Barokah
        $canteen = Canteen::where('name', 'like', '%Barokah%')->first();
        if (!$canteen) {
            $owner = User::where('email', 'like', '%kantin%')->first() ?: User::first();
            $canteen = Canteen::create([
                'user_id' => $owner ? $owner->id : 1,
                'name' => 'Toko Barokah',
                'category' => 'Makanan & Minuman',
                'description' => 'Pusat kuliner nikmat, higienis, dan berkah santri Pondok Pesantren Al Mannan.',
                'image' => '/storage/default/canteen_barokah.jpg',
                'status' => 'approved',
                'open_time' => '07:00',
                'close_time' => '22:00',
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'is_gofood_mode' => false,
                'whatsapp_number' => '081234567890',
                'balance' => 0,
            ]);
        } else {
            $canteen->update([
                'status' => 'approved',
                'open_time' => '07:00',
                'close_time' => '22:00',
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'description' => 'Pusat kuliner nikmat, higienis, dan berkah santri Pondok Pesantren Al Mannan.',
            ]);
        }

        // Pastikan nama toko bersih dan jelas
        if (strpos($canteen->name, 'Barokah') === false) {
            $canteen->name = 'Toko Barokah';
            $canteen->save();
        }

        // 2. Buat / Perbarui Produk Toko Barokah
        $productDefs = [
            [
                'name' => 'Nasi Ayam Geprek Barokah',
                'category' => 'Makanan Berat',
                'description' => 'Ayam goreng renyah digeprek dengan sambal bawang khas Barokah, disajikan dengan nasi hangat dan lalapan.',
                'price' => 15000,
                'hpp' => 12000,
                'stock' => 99,
                'is_available' => true,
                'variant_config' => [
                    'options' => [
                        [
                            'name' => 'Level Pedas',
                            'type' => 'radio',
                            'required' => true,
                            'choices' => [
                                ['label' => 'Level 1 (Sedang)', 'extra_price' => 0],
                                ['label' => 'Level 3 (Pedas Mantap)', 'extra_price' => 0],
                                ['label' => 'Level 5 (Super Pedas)', 'extra_price' => 1000],
                            ]
                        ],
                        [
                            'name' => 'Pilihan Nasi',
                            'type' => 'radio',
                            'required' => false,
                            'choices' => [
                                ['label' => 'Nasi Putih Biasa', 'extra_price' => 0],
                                ['label' => 'Nasi Uduk Gurih', 'extra_price' => 2000],
                            ]
                        ]
                    ]
                ]
            ],
            [
                'name' => 'Nasi Goreng Spesial Barokah',
                'category' => 'Makanan Berat',
                'description' => 'Nasi goreng bumbu racikan pondok dengan suwiran ayam, sosis, bakso, dan telur ceplok.',
                'price' => 14000,
                'hpp' => 11000,
                'stock' => 85,
                'is_available' => true,
                'variant_config' => [
                    'options' => [
                        [
                            'name' => 'Tingkat Kepedasan',
                            'type' => 'radio',
                            'required' => true,
                            'choices' => [
                                ['label' => 'Tidak Pedas', 'extra_price' => 0],
                                ['label' => 'Sedang', 'extra_price' => 0],
                                ['label' => 'Pedas Manis', 'extra_price' => 0],
                            ]
                        ],
                        [
                            'name' => 'Tipe Telur',
                            'type' => 'radio',
                            'required' => true,
                            'choices' => [
                                ['label' => 'Telur Ceplok 1/2 Matang', 'extra_price' => 0],
                                ['label' => 'Telur Dadar Krispi', 'extra_price' => 0],
                            ]
                        ]
                    ]
                ]
            ],
            [
                'name' => 'Mie Goreng Komplit Barokah',
                'category' => 'Makanan Berat',
                'description' => 'Mie kenyal ditumis dengan sawi segar, telur, ayam suwir, dan bumbu rempah istimewa.',
                'price' => 12000,
                'hpp' => 9500,
                'stock' => 50,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Soto Ayam Lamongan Barokah',
                'category' => 'Makanan Berat',
                'description' => 'Soto ayam kuah kuning gurih dengan koya gurih, sohun, kol, tauge, dan perasan jeruk nipis.',
                'price' => 13000,
                'hpp' => 10000,
                'stock' => 60,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Es Teh Manis Jumbo',
                'category' => 'Minuman Segar',
                'description' => 'Teh melati wangi dingin disajikan dalam cup jumbo 22oz, manis pas dan menyegarkan dahaga.',
                'price' => 4000,
                'hpp' => 2500,
                'stock' => 200,
                'is_available' => true,
                'variant_config' => [
                    'options' => [
                        [
                            'name' => 'Tingkat Manis',
                            'type' => 'radio',
                            'required' => false,
                            'choices' => [
                                ['label' => 'Manis Normal', 'extra_price' => 0],
                                ['label' => 'Kurang Manis (Less Sugar)', 'extra_price' => 0],
                                ['label' => 'Tawar Dingin', 'extra_price' => 0],
                            ]
                        ]
                    ]
                ]
            ],
            [
                'name' => 'Es Jeruk Peras Segar',
                'category' => 'Minuman Segar',
                'description' => 'Perasan jeruk murni asli dengan es batu kristal, kaya vitamin C alami.',
                'price' => 6000,
                'hpp' => 4000,
                'stock' => 100,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Kopi Susu Barokah Gula Aren',
                'category' => 'Minuman Segar',
                'description' => 'Espresso robusta lokal dipadu susu kental manis dan lelehan gula aren murni.',
                'price' => 8000,
                'hpp' => 5500,
                'stock' => 70,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Jus Alpukat Kocok',
                'category' => 'Minuman Segar',
                'description' => 'Alpukat mentega lumer dikocok kental dengan susu coklat dan es serut.',
                'price' => 10000,
                'hpp' => 7000,
                'stock' => 40,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Tahu Bakso Krispi (Isi 4)',
                'category' => 'Snack & Camilan',
                'description' => 'Tahu pong isi adonan bakso sapi gurih, digoreng renyah dengan saus cocolan pedas.',
                'price' => 10000,
                'hpp' => 7500,
                'stock' => 65,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Roti Bakar Coklat Keju Susu',
                'category' => 'Snack & Camilan',
                'description' => 'Roti tawar tebal dipanggang dengan olesan mentega, taburan meses coklat, dan parutan keju cheddar melimpah.',
                'price' => 12000,
                'hpp' => 8500,
                'stock' => 50,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Cireng Krispi Bumbu Rujak',
                'category' => 'Snack & Camilan',
                'description' => 'Cireng kenyal gurih dengan cocolan sambal rujak asam manis pedas yang nendang.',
                'price' => 8000,
                'hpp' => 5500,
                'stock' => 80,
                'is_available' => true,
                'variant_config' => null,
            ],
            [
                'name' => 'Pisang Bakar Keju Coklat',
                'category' => 'Snack & Camilan',
                'description' => 'Pisang raja manis dibakar caramel, disajikan dengan parutan keju melimpah dan susu kental.',
                'price' => 9000,
                'hpp' => 6500,
                'stock' => 45,
                'is_available' => true,
                'variant_config' => null,
            ],
        ];

        $createdProducts = [];
        foreach ($productDefs as $def) {
            $product = Product::where('canteen_id', $canteen->id)
                ->where('name', $def['name'])
                ->first();

            if (!$product) {
                $product = Product::create([
                    'canteen_id' => $canteen->id,
                    'name' => $def['name'],
                    'category' => $def['category'],
                    'description' => $def['description'],
                    'price' => $def['price'],
                    'hpp' => $def['hpp'],
                    'stock' => $def['stock'],
                    'sold_count' => rand(15, 80),
                    'rating' => 4.8,
                    'rating_count' => rand(10, 45),
                    'is_available' => $def['is_available'],
                    'variant_config' => $def['variant_config'],
                    'image' => '/storage/default/food_sample.jpg',
                ]);
            } else {
                $product->update([
                    'category' => $def['category'],
                    'description' => $def['description'],
                    'price' => $def['price'],
                    'hpp' => $def['hpp'],
                    'stock' => $def['stock'],
                    'is_available' => $def['is_available'],
                    'variant_config' => $def['variant_config'],
                ]);
            }
            $createdProducts[] = $product;
        }

        // 3. Voucher Khusus Toko Barokah
        Voucher::updateOrCreate(
            ['canteen_id' => $canteen->id, 'code' => 'BAROKAHHEMAT'],
            [
                'title' => 'Promo Barokah Hemat Santri',
                'description' => 'Potongan harga Rp 3.000 untuk jajan menu Barokah minimal belanja Rp 20.000.',
                'discount_type' => 'fixed',
                'discount_amount' => 3000,
                'min_purchase' => 20000,
                'quota' => 100,
                'claimed_count' => 14,
                'valid_until' => $today->copy()->addDays(25),
                'is_active' => true,
            ]
        );

        Voucher::updateOrCreate(
            ['canteen_id' => $canteen->id, 'code' => 'BAROKAHONGKIR'],
            [
                'title' => 'Gratis Ongkir Barokah',
                'description' => 'Potongan ongkir kurir sebesar Rp 2.000 antar langsung ke kamar.',
                'discount_type' => 'delivery_fee',
                'discount_amount' => 2000,
                'min_purchase' => 15000,
                'quota' => 80,
                'claimed_count' => 21,
                'valid_until' => $today->copy()->addDays(25),
                'is_active' => true,
            ]
        );

        // 4. Siapkan Data Pelanggan (Santri & Wali) dan Kurir
        $users = User::role('user')->get();
        if ($users->isEmpty()) {
            $users = User::take(5)->get();
        }

        $courier = User::role('kurir')->first() ?: User::where('name', 'like', '%kurir%')->first();
        $courierId = $courier ? $courier->id : null;

        $sampleProof = '/storage/jumat11September2026/jazzon_caesar_kusuma_wibowo/proof/2LWsCvhgO5GS5W2m80dqvAkZYveza7zAWtx8mxLk.jpg';

        // 5. Data Pesanan Testing Komprehensif
        // Kita akan buat pesanan untuk:
        // - Hari Ini (7 Okt): Berbagai status (pending, waiting_confirmation, processing, completed, cancelled)
        // - Kemarin (6 Okt): Selesai & Lunas
        // - Minggu Ini (3-5 Okt): Selesai & Lunas
        // - Bulan Lalu (Sep 2026): Selesai & Lunas

        $orderTemplates = [
            // ==========================================
            // HARI INI (7 OKTOBER 2026)
            // ==========================================
            [
                'date_offset' => 0,
                'hour' => 10,
                'minute' => 15,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'location' => 'Kamar 12 (Gedung Al-Azhar Lt. 2)',
                'notes' => 'Tolong pedasnya level 3, jangan terlalu lama ya mas.',
                'items' => [
                    ['prod_idx' => 0, 'qty' => 1, 'notes' => 'Level 3 (Pedas Mantap) • Nasi Putih Biasa'],
                    ['prod_idx' => 4, 'qty' => 1, 'notes' => 'Manis Normal • Es Banyak'],
                ],
                'courier' => null,
                'proof_payment' => null,
                'proof_purchase' => null,
                'proof_delivery' => null,
            ],
            [
                'date_offset' => 0,
                'hour' => 11,
                'minute' => 30,
                'status' => 'waiting_confirmation',
                'payment_status' => 'waiting_confirmation',
                'location' => 'Kamar Al-Majid 1 (Asrama Putra)',
                'notes' => 'Sudah ditransfer lewat BCA, mohon segera dicek dan divalidasi.',
                'items' => [
                    ['prod_idx' => 1, 'qty' => 2, 'notes' => 'Sedang • Telur Ceplok 1/2 Matang'],
                    ['prod_idx' => 5, 'qty' => 2, 'notes' => 'Segar dingin'],
                    ['prod_idx' => 8, 'qty' => 1, 'notes' => 'Saus pedas dipisah'],
                ],
                'courier' => null,
                'proof_payment' => $sampleProof,
                'proof_purchase' => null,
                'proof_delivery' => null,
            ],
            [
                'date_offset' => 0,
                'hour' => 12,
                'minute' => 10,
                'status' => 'processing',
                'payment_status' => 'paid',
                'location' => 'Kamar Fatimah 3 (Asrama Putri)',
                'notes' => 'Sedang dimasak oleh pihak dapur toko.',
                'items' => [
                    ['prod_idx' => 3, 'qty' => 1, 'notes' => 'Koya banyakin ya'],
                    ['prod_idx' => 6, 'qty' => 1, 'notes' => 'Kopi susu manis'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => null,
            ],
            [
                'date_offset' => 0,
                'hour' => 12,
                'minute' => 45,
                'status' => 'processing',
                'payment_status' => 'paid',
                'location' => 'Kamar Bilal 4 (Komplek Barat)',
                'notes' => 'Pesanan siap diantar kurir ke lantai 2.',
                'items' => [
                    ['prod_idx' => 0, 'qty' => 2, 'notes' => 'Level 1 (Sedang) • Nasi Uduk Gurih'],
                    ['prod_idx' => 7, 'qty' => 2, 'notes' => 'Alpukat manis dingin'],
                    ['prod_idx' => 9, 'qty' => 1, 'notes' => 'Coklat keju melimpah'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => null,
            ],
            [
                'date_offset' => 0,
                'hour' => 13,
                'minute' => 20,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar 15 (Asrama Ali bin Abi Thalib)',
                'notes' => 'Pesanan diterima dengan baik, rasa mantap.',
                'items' => [
                    ['prod_idx' => 2, 'qty' => 1, 'notes' => 'Mie goreng pedas'],
                    ['prod_idx' => 4, 'qty' => 1, 'notes' => 'Es teh jumbo'],
                    ['prod_idx' => 10, 'qty' => 1, 'notes' => 'Cireng rujak hangat'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
            [
                'date_offset' => 0,
                'hour' => 14,
                'minute' => 05,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar Khadijah 2 (Asrama Putri)',
                'notes' => 'Selesai dan tuntas.',
                'items' => [
                    ['prod_idx' => 0, 'qty' => 3, 'notes' => 'Level 3 • Nasi Putih'],
                    ['prod_idx' => 4, 'qty' => 3, 'notes' => 'Es teh manis jumbo'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
            [
                'date_offset' => 0,
                'hour' => 9,
                'minute' => 30,
                'status' => 'cancelled',
                'payment_status' => 'cancelled',
                'location' => 'Kamar Utsman 1',
                'notes' => 'Dibatalkan: Santri sedang ada jam kegiatan mendadak.',
                'items' => [
                    ['prod_idx' => 1, 'qty' => 1, 'notes' => 'Pedas manis'],
                ],
                'courier' => null,
                'proof_payment' => null,
                'proof_purchase' => null,
                'proof_delivery' => null,
            ],

            // ==========================================
            // KEMARIN (6 OKTOBER 2026)
            // ==========================================
            [
                'date_offset' => 1,
                'hour' => 11,
                'minute' => 40,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar 12',
                'notes' => 'Kemarin siang',
                'items' => [
                    ['prod_idx' => 0, 'qty' => 2, 'notes' => 'Level 3 • Sambal banyak'],
                    ['prod_idx' => 5, 'qty' => 2, 'notes' => 'Es Jeruk segar'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
            [
                'date_offset' => 1,
                'hour' => 13,
                'minute' => 15,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar Al-Majid 2',
                'notes' => 'Makan siang berdua santri kamar',
                'items' => [
                    ['prod_idx' => 1, 'qty' => 2, 'notes' => 'Telur dadar'],
                    ['prod_idx' => 8, 'qty' => 2, 'notes' => 'Tahu bakso krispi'],
                    ['prod_idx' => 4, 'qty' => 2, 'notes' => 'Es teh jumbo'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
            [
                'date_offset' => 1,
                'hour' => 18,
                'minute' => 50,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar Fatimah 1',
                'notes' => 'Makan malam santriwati',
                'items' => [
                    ['prod_idx' => 3, 'qty' => 2, 'notes' => 'Soto hangat'],
                    ['prod_idx' => 9, 'qty' => 1, 'notes' => 'Roti bakar coklat keju'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],

            // ==========================================
            // MINGGU INI (3 - 5 OKTOBER 2026)
            // ==========================================
            [
                'date_offset' => 3,
                'hour' => 12,
                'minute' => 20,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar Bilal 1',
                'notes' => 'Hari Ahad makan bareng',
                'items' => [
                    ['prod_idx' => 0, 'qty' => 3, 'notes' => 'Level 5 • Nasi uduk'],
                    ['prod_idx' => 4, 'qty' => 3, 'notes' => 'Es teh jumbo'],
                    ['prod_idx' => 11, 'qty' => 2, 'notes' => 'Pisang bakar keju'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
            [
                'date_offset' => 4,
                'hour' => 17,
                'minute' => 35,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar Umar 3',
                'notes' => 'Sore hari jajan camilan',
                'items' => [
                    ['prod_idx' => 8, 'qty' => 3, 'notes' => 'Tahu bakso panas'],
                    ['prod_idx' => 10, 'qty' => 2, 'notes' => 'Cireng rujak pedas'],
                    ['prod_idx' => 6, 'qty' => 2, 'notes' => 'Kopi susu aren dingin'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],

            // ==========================================
            // BULAN INI / SEBELUMNYA (AKHIR SEPTEMBER)
            // ==========================================
            [
                'date_offset' => 9,
                'hour' => 12,
                'minute' => 30,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar 12',
                'notes' => 'Rekap transaksi akhir bulan lalu',
                'items' => [
                    ['prod_idx' => 0, 'qty' => 4, 'notes' => 'Level 3'],
                    ['prod_idx' => 4, 'qty' => 4, 'notes' => 'Es teh jumbo'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
            [
                'date_offset' => 15,
                'hour' => 13,
                'minute' => 10,
                'status' => 'completed',
                'payment_status' => 'paid',
                'location' => 'Kamar Abu Bakar 2',
                'notes' => 'Transaksi pertengahan September',
                'items' => [
                    ['prod_idx' => 1, 'qty' => 3, 'notes' => 'Nasgor spesial'],
                    ['prod_idx' => 5, 'qty' => 3, 'notes' => 'Es jeruk peras'],
                ],
                'courier' => $courierId,
                'proof_payment' => $sampleProof,
                'proof_purchase' => $sampleProof,
                'proof_delivery' => $sampleProof,
            ],
        ];

        $checkoutSequence = rand(10000, 99999);

        foreach ($orderTemplates as $idx => $tmpl) {
            $orderTime = $today->copy()
                ->subDays($tmpl['date_offset'])
                ->setTime($tmpl['hour'], $tmpl['minute'], rand(0, 59));

            $user = $users->get($idx % $users->count());

            // Hitung kalkulasi item
            $subtotalProducts = 0;
            $itemsToCreate = [];

            foreach ($tmpl['items'] as $itemDef) {
                $product = $createdProducts[$itemDef['prod_idx']] ?? $createdProducts[0];
                $qty = $itemDef['qty'];
                $price = $product->price;
                $lineTotal = $price * $qty;
                $subtotalProducts += $lineTotal;

                $itemsToCreate[] = [
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'price' => $price,
                    'subtotal' => $lineTotal,
                    'notes' => $itemDef['notes'],
                ];
            }

            $deliveryFee = 3000;
            $adminFee = 2000;
            $grandTotal = $subtotalProducts + $deliveryFee + $adminFee;

            $checkoutId = 'CHK-BAROKAH-' . ($checkoutSequence + $idx);

            $order = Order::create([
                'checkout_id' => $checkoutId,
                'user_id' => $user->id,
                'canteen_id' => $canteen->id,
                'total_price' => $grandTotal,
                'admin_fee' => $adminFee,
                'delivery_fee' => $deliveryFee,
                'status' => $tmpl['status'],
                'payment_status' => $tmpl['payment_status'],
                'courier_id' => $tmpl['courier'],
                'delivery_location' => $tmpl['location'],
                'proof_of_payment' => $tmpl['proof_payment'],
                'proof_of_purchase' => $tmpl['proof_purchase'],
                'proof_of_delivery' => $tmpl['proof_delivery'],
                'is_courier_paid_by_canteen' => in_array($tmpl['status'], ['completed']),
                'created_at' => $orderTime,
                'updated_at' => $orderTime,
            ]);

            foreach ($itemsToCreate as $it) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $it['product_id'],
                    'quantity' => $it['quantity'],
                    'price' => $it['price'],
                    'subtotal' => $it['subtotal'],
                    'notes' => $it['notes'],
                    'created_at' => $orderTime,
                    'updated_at' => $orderTime,
                ]);
            }
        }

        // Invalidate Cache agar data toko dan rekap langsung update seketika
        Cache::flush();
    }
}
