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
use App\Domains\Canteen\CanteenBanner;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class TodayDummyDataSeeder extends Seeder
{
    public function run(): void
    {
        $today = Carbon::now('Asia/Jakarta');
        $sampleImagePath = '/storage/jumat11September2026/jazzon_caesar_kusuma_wibowo/proof/2LWsCvhgO5GS5W2m80dqvAkZYveza7zAWtx8mxLk.jpg';

        // 1. UPDATE USER PROFILES FOR SANTRI & WALI
        $asrul = User::where('email', 'info@staialmannan.ac.id')->first();
        if ($asrul) {
            $asrul->update([
                'phone' => '085784777797',
                'santri_name' => 'Asrul Maaliy',
                'santri_room' => 'Kamar 12',
                'santri_class' => '12 IPA',
                'santri_level' => 'Aliyah',
            ]);
            $asrul->syncRoles(['user']);
        }

        $wali = User::where('email', 'wali@email.com')->first();
        if ($wali) {
            $wali->update([
                'phone' => '081234567890',
                'santri_name' => 'ZIDAN ABDILLAH KAFABIHI',
                'santri_room' => 'Al Majid 1',
                'santri_class' => '10 B',
                'santri_level' => 'Aliyah',
            ]);
            $wali->syncRoles(['user']);
        }

        $charissa = User::where('email', 'emprut.algibrut88@gmail.com')->first() ?: User::where('name', 'like', '%Charissa%')->first();
        if ($charissa) {
            $charissa->update([
                'phone' => '085812349988',
                'santri_name' => 'Charissa Alfariz',
                'santri_room' => 'Kamar Fatimah 3',
                'santri_class' => '11 IPS',
                'santri_level' => 'Aliyah',
            ]);
            $charissa->syncRoles(['user']);
        }

        // Dedicated Guru / Staff Users Across Units
        $guru = User::firstOrCreate(
            ['email' => 'guru@email.com'],
            ['name' => 'Ustadz Ahmad Fauzi, M.Pd.', 'password' => bcrypt('password')]
        );
        $guru->update([
            'phone' => '081299887766',
            'is_teacher' => true,
            'niy' => 'NIY. 1988.02.045',
            'teacher_unit' => 'MA',
            'santri_name' => null,
            'santri_room' => null,
            'santri_class' => null,
            'santri_level' => null,
        ]);
        $guru->syncRoles(['user']);

        $guruSmp = User::firstOrCreate(
            ['email' => 'guru.smp@email.com'],
            ['name' => 'Ustadzah Siti Maryam, S.Pd.', 'password' => bcrypt('password')]
        );
        $guruSmp->update([
            'phone' => '081377889900',
            'is_teacher' => true,
            'niy' => 'NIY. 1993.07.088',
            'teacher_unit' => 'SMP',
            'santri_name' => null,
            'santri_room' => null,
            'santri_class' => null,
            'santri_level' => null,
        ]);
        $guruSmp->syncRoles(['user']);

        $dosen = User::firstOrCreate(
            ['email' => 'dosen.kampus@email.com'],
            ['name' => 'Dr. H. M. Zainuddin, M.Ag.', 'password' => bcrypt('password')]
        );
        $dosen->update([
            'phone' => '081122334455',
            'is_teacher' => true,
            'niy' => 'NIY. 1979.11.012',
            'teacher_unit' => 'Kampus',
            'santri_name' => null,
            'santri_room' => null,
            'santri_class' => null,
            'santri_level' => null,
        ]);
        $dosen->syncRoles(['user']);

        $guruMi = User::firstOrCreate(
            ['email' => 'guru.mi@email.com'],
            ['name' => 'Ibu Nurul Hidayati, S.Pd.I.', 'password' => bcrypt('password')]
        );
        $guruMi->update([
            'phone' => '085233445566',
            'is_teacher' => true,
            'niy' => 'NIY. 1995.04.103',
            'teacher_unit' => 'MI',
            'santri_name' => null,
            'santri_room' => null,
            'santri_class' => null,
            'santri_level' => null,
        ]);
        $guruMi->syncRoles(['user']);

        $kurir = User::where('email', 'kurir@email.com')->first();
        if ($kurir) {
            $kurir->syncRoles(['kurir']);
        }

        // 2. OPEN ALL CANTEENS & CLEAR FORCE-CLOSED CACHE
        Cache::flush();
        Canteen::query()->update([
            'status' => 'approved',
            'open_time' => '06:00:00',
            'close_time' => '23:00:00',
        ]);

        // Assign courier to canteens
        if ($kurir) {
            $canteenIds = Canteen::pluck('id');
            foreach ($canteenIds as $cId) {
                DB::table('canteen_couriers')->updateOrInsert(
                    ['canteen_id' => $cId, 'courier_id' => $kurir->id],
                    ['created_at' => $today, 'updated_at' => $today]
                );
            }
        }

        // 3. SEED RICH VARIANTS ON POPULAR PRODUCTS
        $gacoan = Product::where('name', 'Mie Gacoan')->first();
        if ($gacoan) {
            $gacoan->update([
                'variant_config' => [
                    'spicy' => ['enabled' => true, 'label' => 'Level Pedas', 'options' => ['Lv 0', 'Lv 1', 'Lv 2', 'Lv 3', 'Lv 4', 'Lv 6', 'Lv 8']],
                    'portion' => ['enabled' => true, 'label' => 'Porsi', 'options' => ['Biasa', 'Jumbo (+Rp 3.000)']],
                    'temperature' => ['enabled' => false],
                    'sugar' => ['enabled' => false],
                    'custom' => [
                        'enabled' => true,
                        'groups' => [
                            [
                                'name' => 'Ekstra Topping',
                                'options' => [
                                    ['name' => 'Pangsit Goreng (+Rp 2.000)', 'price' => 2000],
                                    ['name' => 'Udang Keju (+Rp 3.000)', 'price' => 3000]
                                ]
                            ]
                        ]
                    ]
                ]
            ]);
        }

        $baksoMercon = Product::where('name', 'Bakso Mercon')->first();
        if ($baksoMercon) {
            $baksoMercon->update([
                'variant_config' => [
                    'spicy' => ['enabled' => true, 'label' => 'Level Pedas', 'options' => ['Sedang', 'Pedas', 'Ekstra Mercon']],
                    'portion' => ['enabled' => true, 'label' => 'Porsi', 'options' => ['Porsi Biasa', 'Porsi Jumbo (+Rp 5.000)']],
                    'temperature' => ['enabled' => false],
                    'sugar' => ['enabled' => false],
                    'custom' => [
                        'enabled' => true,
                        'groups' => [
                            [
                                'name' => 'Pilihan Kuah',
                                'options' => [
                                    ['name' => 'Kuah Campur', 'price' => 0],
                                    ['name' => 'Kuah Dipisah', 'price' => 0]
                                ]
                            ]
                        ]
                    ]
                ]
            ]);
        }

        $seblak = Product::where('name', 'like', '%Seblak%')->first();
        if ($seblak) {
            $seblak->update([
                'variant_config' => [
                    'spicy' => ['enabled' => true, 'label' => 'Level Kepedasan', 'options' => ['Lv 1', 'Lv 2', 'Lv 3', 'Lv 4', 'Lv 5']],
                    'portion' => ['enabled' => false],
                    'temperature' => ['enabled' => false],
                    'sugar' => ['enabled' => false],
                    'custom' => [
                        'enabled' => true,
                        'groups' => [
                            [
                                'name' => 'Topping Tambahan',
                                'options' => [
                                    ['name' => 'Telur Ceplok (+Rp 3.000)', 'price' => 3000],
                                    ['name' => 'Sosis Sapi (+Rp 2.000)', 'price' => 2000],
                                    ['name' => 'Cikuwa Seafood (+Rp 2.500)', 'price' => 2500]
                                ]
                            ]
                        ]
                    ]
                ]
            ]);
        }

        $dimsumMentai = Product::where('name', 'like', '%DIMSUM%')->first();
        if ($dimsumMentai) {
            $dimsumMentai->update([
                'variant_config' => [
                    'spicy' => ['enabled' => false],
                    'portion' => ['enabled' => true, 'label' => 'Isi', 'options' => ['Isi 4 Pcs', 'Isi 6 Pcs (+Rp 8.000)']],
                    'temperature' => ['enabled' => true, 'label' => 'Sajian', 'options' => ['Hangat / Kukus', 'Goreng Crispy']],
                    'sugar' => ['enabled' => false],
                    'custom' => [
                        'enabled' => true,
                        'groups' => [
                            [
                                'name' => 'Pilihan Saus',
                                'options' => [
                                    ['name' => 'Saus Mentai Bakar', 'price' => 0],
                                    ['name' => 'Chili Oil Pedas Gurih', 'price' => 0],
                                    ['name' => 'Saus Asam Manis', 'price' => 0]
                                ]
                            ]
                        ]
                    ]
                ]
            ]);
        }

        // 4. SEED CANTEEN BANNERS
        $firstCanteen = Canteen::first();
        CanteenBanner::truncate();
        CanteenBanner::create([
            'canteen_id' => $firstCanteen ? $firstCanteen->id : 4,
            'title' => 'Promo Spesial Santri Al-Mannan - Diskon s/d 50%',
            'image_path' => $sampleImagePath,
            'status' => 'active',
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        CanteenBanner::create([
            'canteen_id' => $firstCanteen ? $firstCanteen->id : 4,
            'title' => 'Gratis Ongkir Khusus Pengantaran Kamar Santri',
            'image_path' => $sampleImagePath,
            'status' => 'active',
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        CanteenBanner::create([
            'canteen_id' => $firstCanteen ? $firstCanteen->id : 4,
            'title' => 'Jumat Berkah - Menu Sehat, Lezat, & Higienis',
            'image_path' => $sampleImagePath,
            'status' => 'active',
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        // 5. SEED VOUCHERS
        Voucher::query()->delete();
        UserVoucher::query()->delete();

        // 5.1 VOUCHER BERLAKU UNTUK SEMUA WALI & SANTRI (target_type: 'all')
        $v1 = Voucher::create([
            'code' => 'ONGKIRHEMAT',
            'title' => 'Gratis Ongkir Kamar Santri',
            'description' => 'Potongan ongkos kirim Rp 3.000 khusus pengantaran kamar santri Al-Mannan (Berlaku untuk semua wali & santri).',
            'discount_type' => 'delivery_fee',
            'discount_amount' => 3000,
            'min_purchase' => 10000,
            'quota' => 200,
            'claimed_count' => 14,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'all',
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        $v2 = Voucher::create([
            'code' => 'SANTRIBERKAH',
            'title' => 'Diskon Belanja Rp 5.000',
            'description' => 'Potongan harga belanja Rp 5.000 untuk minimal transaksi Rp 15.000 (Berlaku untuk semua wali & santri).',
            'discount_type' => 'product_discount',
            'discount_amount' => 5000,
            'min_purchase' => 15000,
            'quota' => 150,
            'claimed_count' => 18,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'all',
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        $v3 = Voucher::create([
            'code' => 'BEBASADMIN',
            'title' => 'Bebas Biaya Layanan & Admin',
            'description' => 'Subsidi biaya admin Rp 2.000 gratis untuk semua transaksi santri hari ini (Berlaku untuk semua wali & santri).',
            'discount_type' => 'admin_fee',
            'discount_amount' => 2000,
            'min_purchase' => 15000,
            'quota' => 300,
            'claimed_count' => 25,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'all',
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        $vKenyang = Voucher::create([
            'code' => 'KENYANG40RB',
            'title' => 'Diskon Spesial Belanja Rp 10.000 (Min. Rp 40.000)',
            'description' => 'Potongan harga belanja Rp 10.000 untuk pembelian di atas Rp 40.000 atau lebih dari 5 porsi jajan santri.',
            'discount_type' => 'product_discount',
            'discount_amount' => 10000,
            'min_purchase' => 40000,
            'quota' => 250,
            'claimed_count' => 0,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'all',
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        // 5.2 VOUCHER KHUSUS DITUJUKAN KE WALI-WALI TERTENTU (target_type: 'specific')
        // Voucher 4: Khusus untuk Charissa Alfariz & Wali Zidan
        $targetWaliCharissaAndZidan = array_values(array_filter([$charissa?->id, $wali?->id]));
        $v4 = Voucher::create([
            'code' => 'WALIHEBAT',
            'title' => 'Apresiasi Wali Hebat - Diskon Rp 15.000',
            'description' => 'Kupon apresiasi Rp 15.000 khusus ditujukan kepada wali terpilih (Charissa Alfariz & Wali Zidan).',
            'discount_type' => 'product_discount',
            'discount_amount' => 15000,
            'min_purchase' => 30000,
            'quota' => 50,
            'claimed_count' => 5,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'specific',
            'target_user_ids' => $targetWaliCharissaAndZidan,
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        // Voucher 5: Subsidi Beasiswa Khusus Asrul Maaliy & Charissa Alfariz
        $targetBeasiswaAsrulAndCharissa = array_values(array_filter([$asrul?->id, $charissa?->id]));
        $v5 = Voucher::create([
            'code' => 'BEASISWAKANTIN',
            'title' => 'Subsidi Santri Berprestasi Rp 20.000',
            'description' => 'Bantuan subsidi makanan santri Rp 20.000 khusus santri berprestasi (Asrul Maaliy & Charissa Alfariz).',
            'discount_type' => 'product_discount',
            'discount_amount' => 20000,
            'min_purchase' => 25000,
            'quota' => 30,
            'claimed_count' => 2,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'specific',
            'target_user_ids' => $targetBeasiswaAsrulAndCharissa,
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        // Voucher 6: Khusus Santri Kamar 12 (Hanya Asrul Maaliy)
        $targetKamar12 = array_values(array_filter([$asrul?->id]));
        $v6 = Voucher::create([
            'code' => 'VIPASRUL',
            'title' => 'Kupon Khusus Santri Kamar 12 - Diskon Rp 10.000',
            'description' => 'Kupon apresiasi khusus santri Kamar 12 (Asrul Maaliy).',
            'discount_type' => 'product_discount',
            'discount_amount' => 10000,
            'min_purchase' => 20000,
            'quota' => 20,
            'claimed_count' => 1,
            'valid_until' => $today->copy()->addDays(14),
            'is_active' => true,
            'target_type' => 'specific',
            'target_user_ids' => $targetKamar12,
            'created_by_user_id' => 2,
            'created_at' => $today,
            'updated_at' => $today,
        ]);

        // 6. SEED CLAIMED VOUCHERS FOR USERS (Siap Digunakan di Dompet / Keranjang)
        if ($charissa) {
            // Charissa sudah klaim 1 voucher semua wali (ONGKIRHEMAT) & 1 voucher khusus dirinya (WALIHEBAT)
            UserVoucher::create([
                'user_id' => $charissa->id,
                'voucher_id' => $v1->id,
                'claimed_at' => $today->copy()->subHours(1),
                'is_used' => false,
            ]);
            UserVoucher::create([
                'user_id' => $charissa->id,
                'voucher_id' => $v4->id,
                'claimed_at' => $today->copy()->subMinutes(30),
                'is_used' => false,
            ]);
        }

        if ($asrul) {
            UserVoucher::create([
                'user_id' => $asrul->id,
                'voucher_id' => $v1->id,
                'claimed_at' => $today->copy()->subMinutes(20),
                'is_used' => false,
            ]);
            UserVoucher::create([
                'user_id' => $asrul->id,
                'voucher_id' => $v2->id,
                'claimed_at' => $today->copy()->subMinutes(15),
                'is_used' => false,
            ]);
            UserVoucher::create([
                'user_id' => $asrul->id,
                'voucher_id' => $v6->id, // VIPASRUL
                'claimed_at' => $today->copy()->subMinutes(10),
                'is_used' => false,
            ]);
        }

        if ($wali) {
            UserVoucher::create([
                'user_id' => $wali->id,
                'voucher_id' => $v1->id,
                'claimed_at' => $today->copy()->subMinutes(25),
                'is_used' => false,
            ]);
            UserVoucher::create([
                'user_id' => $wali->id,
                'voucher_id' => $v4->id, // WALIHEBAT
                'claimed_at' => $today->copy()->subMinutes(18),
                'is_used' => false,
            ]);
        }

        // 7. SEED REALISTIC ORDERS FOR TODAY (2026-10-02)
        // Bersihkan order dummy hari ini jika ada agar tidak terduplikasi saat re-seeding
        $todayPrefix = 'CHK-' . $today->format('Ymd');
        $oldDummyOrderIds = Order::where('checkout_id', 'like', $todayPrefix . '%')->pluck('id');
        if ($oldDummyOrderIds->isNotEmpty()) {
            OrderItem::whereIn('order_id', $oldDummyOrderIds)->delete();
            Order::whereIn('id', $oldDummyOrderIds)->delete();
        }

        $canteenGacoan = Canteen::where('name', 'like', '%Gacoan%')->first() ?: Canteen::first();
        $canteenBakso = Canteen::where('name', 'like', '%BAKSO%')->first() ?: Canteen::skip(1)->first();
        $canteenSeblak = Canteen::where('name', 'like', '%SEBLAK%')->first() ?: Canteen::skip(2)->first();
        $canteenDimsum = Canteen::where('name', 'like', '%DIMSUM%')->first() ?: Canteen::skip(3)->first();
        $canteenPadang = Canteen::where('name', 'like', '%PADANG%')->first() ?: Canteen::skip(4)->first();

        $prodGacoan = Product::where('canteen_id', $canteenGacoan->id)->first();
        $prodBakso = Product::where('canteen_id', $canteenBakso->id)->first();
        $prodSeblak = Product::where('canteen_id', $canteenSeblak->id)->first();
        $prodDimsum = Product::where('canteen_id', $canteenDimsum->id)->first();
        $prodPadang = Product::where('canteen_id', $canteenPadang->id)->first();

        // 7.1 ORDER 1: DALAM PROSES - Menunggu Pembayaran (unpaid)
        // User: Asrul Maaliy
        if ($asrul && $prodGacoan) {
            $t1 = $today->copy()->subMinutes(18);
            $o1 = Order::create([
                'user_id' => $asrul->id,
                'canteen_id' => $canteenGacoan->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-ASR01',
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'total_price' => 33000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Kamar 12',
                'custom_notes' => 'Tolong diantar sebelum jam istirahat ya kak',
                'created_at' => $t1,
                'updated_at' => $t1,
            ]);

            OrderItem::create([
                'order_id' => $o1->id,
                'product_id' => $prodGacoan->id,
                'quantity' => 2,
                'price' => 14000,
                'subtotal' => 28000,
                'notes' => '[Lv 2 | Biasa] • Cabai segar, kerupuk banyakin',
                'created_at' => $t1,
                'updated_at' => $t1,
            ]);
        }

        // 7.2 ORDER 2: DALAM PROSES - Menunggu Validasi Bukti Transfer (waiting_confirmation) + Voucher Diskon
        // User: Wali Zidan
        if ($wali && $prodBakso) {
            $t2 = $today->copy()->subMinutes(35);
            $o2 = Order::create([
                'user_id' => $wali->id,
                'canteen_id' => $canteenBakso->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-ZID02',
                'status' => 'pending',
                'payment_status' => 'waiting_confirmation',
                'voucher_id' => $v2->id,
                'voucher_discount' => 5000,
                'total_price' => 31000, // 31.000 (setelah diskon Rp 5.000)
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Al Majid 1',
                'proof_of_payment' => [$sampleImagePath],
                'custom_notes' => 'Pesanan titipan santri Zidan',
                'created_at' => $t2,
                'updated_at' => $t2,
            ]);

            OrderItem::create([
                'order_id' => $o2->id,
                'product_id' => $prodBakso->id,
                'quantity' => 2,
                'price' => 15500,
                'subtotal' => 31000,
                'notes' => '[Lv 3 | Porsi Jumbo] • Kuah kaldu ekstra gurih, kuah dipisah',
                'created_at' => $t2,
                'updated_at' => $t2,
            ]);
        }

        // 7.3 ORDER 3: DALAM PROSES - Sedang Dimasak Toko (processing) + Kurir Ditugaskan
        // User: Asrul Maaliy
        if ($asrul && $prodSeblak) {
            $t3 = $today->copy()->subMinutes(55);
            $o3 = Order::create([
                'user_id' => $asrul->id,
                'canteen_id' => $canteenSeblak->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-ASR03',
                'status' => 'processing',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 41000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Kamar 12',
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'custom_notes' => 'Mohon dibuat pedas sedang saja',
                'created_at' => $t3,
                'updated_at' => $t3,
            ]);

            OrderItem::create([
                'order_id' => $o3->id,
                'product_id' => $prodSeblak->id,
                'quantity' => 2,
                'price' => 18000,
                'subtotal' => 36000,
                'notes' => '[Lv 2 | Sosis & Telur] • Kuah kental pedas manis mantap',
                'created_at' => $t3,
                'updated_at' => $t3,
            ]);
        }

        // 7.4 ORDER 4: DALAM PROSES - Sedang Diantar Kurir (processing) + Voucher Gratis Ongkir
        // User: Wali Zidan
        if ($wali && $prodDimsum) {
            $t4 = $today->copy()->subHours(1)->subMinutes(20);
            $o4 = Order::create([
                'user_id' => $wali->id,
                'canteen_id' => $canteenDimsum->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-ZID04',
                'status' => 'processing',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'voucher_id' => $v1->id,
                'voucher_discount' => 3000,
                'total_price' => 42000, // Ongkir Rp 0 (Diskon voucher) + Admin 2.000 + Subtotal 40.000
                'delivery_fee' => 0,
                'admin_fee' => 2000,
                'delivery_location' => 'Al Majid 1',
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'custom_notes' => 'Kurir tolong konfirmasi jika sudah di gerbang asrama',
                'created_at' => $t4,
                'updated_at' => $t4,
            ]);

            OrderItem::create([
                'order_id' => $o4->id,
                'product_id' => $prodDimsum->id,
                'quantity' => 2,
                'price' => 20000,
                'subtotal' => 40000,
                'notes' => '[Saus Mentai | Hangat] • Saus dibakar lumer, sendok garpu disertakan',
                'created_at' => $t4,
                'updated_at' => $t4,
            ]);
        }

        // 7.5 ORDER 5: RIWAYAT SELESAI (completed) - 3 Bukti Lengkap (Bayar, Kasir, Serah Terima)
        // User: Asrul Maaliy
        if ($asrul && $prodPadang) {
            $t5 = $today->copy()->subHours(2)->subMinutes(45);
            $o5 = Order::create([
                'user_id' => $asrul->id,
                'canteen_id' => $canteenPadang->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-ASR05',
                'status' => 'completed',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 30000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Kamar 12',
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'proof_of_delivery' => [$sampleImagePath],
                'custom_notes' => 'Pesanan makan siang santri telah selesai diantar',
                'created_at' => $t5,
                'updated_at' => $t5,
            ]);

            OrderItem::create([
                'order_id' => $o5->id,
                'product_id' => $prodPadang->id,
                'quantity' => 1,
                'price' => 25000,
                'subtotal' => 25000,
                'notes' => '[Paha Atas | Sambal Ijo] • Sayur nangka & daun singkong banyakin',
                'created_at' => $t5,
                'updated_at' => $t5,
            ]);
        }

        // 7.6 ORDER 6: RIWAYAT SELESAI MULTI-TOKO BATCH (completed)
        // User: Wali Zidan
        if ($wali && $prodGacoan && $prodBakso) {
            $t6 = $today->copy()->subHours(4);
            $batchCode = 'CHK-' . $today->format('Ymd') . '-ZID99';

            $o6_1 = Order::create([
                'user_id' => $wali->id,
                'canteen_id' => $canteenGacoan->id,
                'checkout_id' => $batchCode,
                'status' => 'completed',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 19000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Al Majid 1',
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'proof_of_delivery' => [$sampleImagePath],
                'created_at' => $t6,
                'updated_at' => $t6,
            ]);

            OrderItem::create([
                'order_id' => $o6_1->id,
                'product_id' => $prodGacoan->id,
                'quantity' => 1,
                'price' => 14000,
                'subtotal' => 14000,
                'notes' => '[Lv 1 | Biasa] • Tidak pakai pedas berlebih',
                'created_at' => $t6,
                'updated_at' => $t6,
            ]);

            $o6_2 = Order::create([
                'user_id' => $wali->id,
                'canteen_id' => $canteenBakso->id,
                'checkout_id' => $batchCode,
                'status' => 'completed',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 19500,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Al Majid 1',
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'proof_of_delivery' => [$sampleImagePath],
                'created_at' => $t6,
                'updated_at' => $t6,
            ]);

            OrderItem::create([
                'order_id' => $o6_2->id,
                'product_id' => $prodBakso->id,
                'quantity' => 1,
                'price' => 14500,
                'subtotal' => 14500,
                'notes' => '[Porsi Biasa | Es] • Kuah bening segar',
                'created_at' => $t6,
                'updated_at' => $t6,
            ]);
        }

        // 7.7 ORDER 7: PESANAN PRIORITAS GURU MA - Sedang Diantar Kurir Langsung (processing)
        if ($guru && $prodGacoan && $canteenGacoan) {
            $t7 = $today->copy()->subMinutes(25);
            $o7 = Order::create([
                'user_id' => $guru->id,
                'canteen_id' => $canteenGacoan->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-GURUMA01',
                'status' => 'processing',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 19000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Ruang Guru MA (Lantai 2 - Meja 04)',
                'order_for' => 'guru',
                'is_priority' => true,
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'custom_notes' => 'Diantar langsung ke meja Ustadz Fauzi di Ruang Guru MA',
                'created_at' => $t7,
                'updated_at' => $t7,
            ]);

            OrderItem::create([
                'order_id' => $o7->id,
                'product_id' => $prodGacoan->id,
                'quantity' => 1,
                'price' => 14000,
                'subtotal' => 14000,
                'notes' => '[Lv 2 | Biasa] • Cabai dipisah jika bisa',
                'created_at' => $t7,
                'updated_at' => $t7,
            ]);
        }

        // 7.8 ORDER 8: PESANAN PRIORITAS GURU SMP - Menunggu Konfirmasi Toko (pending)
        if ($guruSmp && $prodSeblak && $canteenSeblak) {
            $t8 = $today->copy()->subMinutes(12);
            $o8 = Order::create([
                'user_id' => $guruSmp->id,
                'canteen_id' => $canteenSeblak->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-GURUSMP02',
                'status' => 'pending',
                'payment_status' => 'paid',
                'courier_id' => null,
                'total_price' => 21000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Kantor Guru SMP (Ruang Piket Lantai 1)',
                'order_for' => 'guru',
                'is_priority' => true,
                'proof_of_payment' => [$sampleImagePath],
                'custom_notes' => 'Titip di meja piket guru SMP ya',
                'created_at' => $t8,
                'updated_at' => $t8,
            ]);

            OrderItem::create([
                'order_id' => $o8->id,
                'product_id' => $prodSeblak->id,
                'quantity' => 1,
                'price' => 16000,
                'subtotal' => 16000,
                'notes' => '[Pedas Sedang] • Sayur sawi dan telur ditambah',
                'created_at' => $t8,
                'updated_at' => $t8,
            ]);
        }

        // 7.9 ORDER 9: PESANAN PRIORITAS DOSEN KAMPUS - Riwayat Selesai Lengkap (completed)
        if ($dosen && $prodPadang && $canteenPadang) {
            $t9 = $today->copy()->subHours(1)->subMinutes(40);
            $o9 = Order::create([
                'user_id' => $dosen->id,
                'canteen_id' => $canteenPadang->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-DOSEN03',
                'status' => 'completed',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 30000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Gedung Rektorat Kampus STAI Al-Mannan (Ruang Dosen 01)',
                'order_for' => 'guru',
                'is_priority' => true,
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'proof_of_delivery' => [$sampleImagePath],
                'custom_notes' => 'Pesanan makan siang Dr. Zainuddin telah selesai diantar ke Ruang Dosen',
                'created_at' => $t9,
                'updated_at' => $t9,
            ]);

            OrderItem::create([
                'order_id' => $o9->id,
                'product_id' => $prodPadang->id,
                'quantity' => 1,
                'price' => 25000,
                'subtotal' => 25000,
                'notes' => '[Rendang Daging Sapi] • Sambal hijau & kuah gulai dipisah',
                'created_at' => $t9,
                'updated_at' => $t9,
            ]);
        }

        // 7.10 ORDER 10: PESANAN PRIORITAS GURU MI - Sedang Diantar Kurir (processing)
        if ($guruMi && $prodBakso && $canteenBakso) {
            $t10 = $today->copy()->subMinutes(18);
            $o10 = Order::create([
                'user_id' => $guruMi->id,
                'canteen_id' => $canteenBakso->id,
                'checkout_id' => 'CHK-' . $today->format('Ymd') . '-GURUMI04',
                'status' => 'processing',
                'payment_status' => 'paid',
                'courier_id' => $kurir ? $kurir->id : null,
                'total_price' => 19500,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'delivery_location' => 'Kantor Guru MI (Gedung Timur)',
                'order_for' => 'guru',
                'is_priority' => true,
                'proof_of_payment' => [$sampleImagePath],
                'proof_of_purchase' => [$sampleImagePath],
                'custom_notes' => 'Untuk Bu Nurul di ruang guru MI',
                'created_at' => $t10,
                'updated_at' => $t10,
            ]);

            OrderItem::create([
                'order_id' => $o10->id,
                'product_id' => $prodBakso->id,
                'quantity' => 1,
                'price' => 14500,
                'subtotal' => 14500,
                'notes' => '[Bakso Urat | Kuah Panas] • Sambal dan kecap banyakin',
                'created_at' => $t10,
                'updated_at' => $t10,
            ]);
        }
    }
}
