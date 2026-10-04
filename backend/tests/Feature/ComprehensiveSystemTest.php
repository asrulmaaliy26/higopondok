<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\CanteenBanner;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ComprehensiveSystemTest extends TestCase
{
    use \Illuminate\Foundation\Testing\DatabaseTransactions;

    protected $admin;
    protected $kantinUser;
    protected $canteen;
    protected $kurirUser;
    protected $santriUser;
    protected $product;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // Retrieve or mock seed users
        $this->admin = User::firstOrCreate(
            ['email' => 'admin_test@higopondok.com'],
            ['name' => 'Admin Test', 'password' => bcrypt('password'), 'role' => 'admin']
        );
        $this->admin->syncRoles(['admin']);

        $this->kantinUser = User::firstOrCreate(
            ['email' => 'kantin_test@higopondok.com'],
            ['name' => 'Kantin Test', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->kantinUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinUser->id],
            [
                'name' => 'Kantin Barokah Test',
                'description' => 'Kantin Uji Coba',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );
        $this->canteen->update([
            'status' => 'approved',
            'open_time' => '00:00:00',
            'close_time' => '23:59:59',
        ]);

        $this->kurirUser = User::firstOrCreate(
            ['email' => 'kurir_test@higopondok.com'],
            ['name' => 'Kurir Test', 'password' => bcrypt('password'), 'role' => 'kurir']
        );
        $this->kurirUser->syncRoles(['kurir']);

        // Assign courier to canteen if not exists
        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $this->canteen->id, 'courier_id' => $this->kurirUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_test@higopondok.com'],
            [
                'name' => 'Santri Test',
                'password' => bcrypt('password'),
                'role' => 'user',
                'phone' => '081234567890',
                'santri_name' => 'Ahmad Santri',
                'santri_room' => 'Kamar 07',
                'santri_class' => '12 A',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->update([
            'phone' => '081234567890',
            'santri_name' => 'Ahmad Santri',
            'santri_room' => 'Kamar 07',
            'santri_class' => '12 A',
            'santri_level' => 'Aliyah',
        ]);
        $this->santriUser->syncRoles(['user']);

        $this->product = Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Ayam Geprek Sambal Test'],
            [
                'description' => 'Ayam geprek gurih pedas',
                'price' => 15000,
                'stock' => 50,
                'is_available' => true,
                'category' => 'Makanan',
                'variant_config' => [
                    'spicy' => ['enabled' => true, 'label' => 'Level Pedas', 'options' => ['Lv 1', 'Lv 2']],
                    'portion' => ['enabled' => true, 'label' => 'Porsi', 'options' => ['Biasa', 'Jumbo (+Rp 3.000)']],
                    'custom' => ['enabled' => false]
                ]
            ]
        );
        $this->product->update(['stock' => 50, 'is_available' => true]);
    }

    /**
     * 1. Test Sistem Banner: Admin & Kantin create/update, Santri view public
     */
    public function test_banner_system_for_admin_kantin_and_santri()
    {
        // Kantin creates banner
        $file = UploadedFile::fake()->image('banner_promo.jpg', 600, 300);
        $response = $this->actingAs($this->kantinUser)
            ->postJson('/api/canteen/banners', [
                'canteen_id' => $this->canteen->id,
                'title' => 'Promo Diskon Kantin',
                'image' => $file,
            ]);
        $response->assertStatus(200);
        $bannerId = $response->json('banner.id');

        // Santri views public banners
        $pubRes = $this->getJson('/api/banners');
        $pubRes->assertStatus(200);
        $this->assertTrue(collect($pubRes->json())->contains('title', 'Promo Diskon Kantin'));

        // Kantin toggles banner status
        $toggleRes = $this->actingAs($this->kantinUser)
            ->putJson("/api/canteen/banners/{$bannerId}/status");
        $toggleRes->assertStatus(200);
        $this->assertEquals('inactive', $toggleRes->json('banner.status'));
    }

    /**
     * 2. Test Sistem Voucher: Kantin creates voucher, Santri claims & uses
     */
    public function test_voucher_system_creation_claim_and_options()
    {
        // Kantin creates voucher
        $code = 'TEST' . rand(100, 999);
        $voucherRes = $this->actingAs($this->kantinUser)
            ->postJson('/api/canteen/vouchers', [
                'canteen_id' => $this->canteen->id,
                'code' => $code,
                'title' => 'Voucher Diskon Santri',
                'discount_type' => 'product_discount',
                'discount_amount' => 5000,
                'min_purchase' => 10000,
                'quota' => 100,
                'valid_until' => now()->addDays(7)->format('Y-m-d H:i:s'),
                'target_type' => 'all',
            ]);
        
        $voucherRes->assertStatus(201);
        $voucherId = $voucherRes->json('voucher.id');

        // Santri views available vouchers
        $listRes = $this->actingAs($this->santriUser)->getJson('/api/vouchers');
        $listRes->assertStatus(200);

        // Santri claims voucher
        $claimRes = $this->actingAs($this->santriUser)->postJson("/api/vouchers/{$voucherId}/claim");
        $claimRes->assertStatus(201);

        // Santri views claimed vouchers
        $myVouchersRes = $this->actingAs($this->santriUser)->getJson('/api/my-vouchers');
        $myVouchersRes->assertStatus(200);
        $this->assertTrue(collect($myVouchersRes->json())->contains('voucher_id', $voucherId));
    }

    /**
     * 3. Test Checkout with Variant, Extra Price, & Delivery Fee
     */
    public function test_checkout_with_variant_and_extra_price()
    {
        $payload = [
            'delivery_location' => 'Kamar 07',
            'canteens' => [
                [
                    'canteen_id' => $this->canteen->id,
                    'items' => [
                        [
                            'product_id' => $this->product->id,
                            'quantity' => 2,
                            'extra_price' => 3000, // Jumbo +3000
                            'notes' => '[Lv 2 | Jumbo] • Jangan terlalu banyak kecap'
                        ]
                    ]
                ]
            ]
        ];

        $checkoutRes = $this->actingAs($this->santriUser)->postJson('/api/orders/batch', $payload);
        $checkoutRes->assertStatus(201);
        $createdOrders = $checkoutRes->json('orders');
        $this->assertNotEmpty($createdOrders);

        $order = $createdOrders[0];
        // Price per item = 15000 + 3000 = 18000. 2 qty = 36000.
        // Delivery fee = 3000, Admin fee = 2000. Total price = 36000 + 3000 + 2000 = 41000.
        $this->assertEquals(41000, (int)$order['total_price']);
        $this->assertEquals('pending', $order['status']);
        $this->assertEquals('unpaid', $order['payment_status']);
    }

    /**
     * 4. Test Kejadian: Pesanan lama (unpaid) unggah bukti bayar hari ini
     *    -> created_at otomatis diperbarui ke hari pembayaran (now)
     */
    public function test_old_unpaid_order_upload_payment_proof_shifts_date_to_today()
    {
        // Buat pesanan 5 hari yang lalu
        $pastDate = Carbon::now('Asia/Jakarta')->subDays(5);
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'checkout_id' => 'CHK_TEST_' . rand(1000, 9999),
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 25000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar 07',
            'created_at' => $pastDate,
            'updated_at' => $pastDate,
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'price' => 22000,
            'price_per_item' => 22000,
            'subtotal' => 22000,
            'created_at' => $pastDate,
            'updated_at' => $pastDate,
        ]);

        $this->assertEquals($pastDate->format('Y-m-d'), $order->created_at->format('Y-m-d'));

        // Santri upload bukti bayar HARI INI
        $fakeProof = UploadedFile::fake()->image('bukti_transfer.jpg', 400, 600);
        $uploadRes = $this->actingAs($this->santriUser)->postJson("/api/orders/{$order->id}/payment-proof", [
            'proof_of_payment' => [$fakeProof]
        ]);
        $uploadRes->assertStatus(200);

        // Verifikasi: created_at telah berpindah ke HARI INI
        $order->refresh();
        $orderItem->refresh();

        $todayStr = Carbon::now('Asia/Jakarta')->format('Y-m-d');
        $this->assertEquals($todayStr, $order->created_at->format('Y-m-d'), 'Tanggal pesanan harus berpindah ke hari ini saat bukti bayar diunggah');
        $this->assertEquals($todayStr, $orderItem->created_at->format('Y-m-d'), 'Tanggal item pesanan harus sinkron ke hari pembayaran');
        $this->assertEquals('waiting_confirmation', $order->payment_status);
    }

    /**
     * 5. Test Kejadian: Kantin & Admin memindahkan pesanan ke besok / tanggal tertentu
     */
    public function test_canteen_and_admin_can_reschedule_order_to_tomorrow()
    {
        // Order dibuat hari ini
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'checkout_id' => 'CHK_RESCHEDULE_' . rand(1000, 9999),
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 30000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar 07',
            'courier_id' => $this->kurirUser->id,
            'created_at' => now('Asia/Jakarta'),
            'updated_at' => now('Asia/Jakarta'),
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'price' => 27000,
            'price_per_item' => 27000,
            'subtotal' => 27000,
            'created_at' => now('Asia/Jakarta'),
            'updated_at' => now('Asia/Jakarta'),
        ]);

        // Kantin menjadwalkan pesanan ke BESOK
        $tomorrow = Carbon::now('Asia/Jakarta')->addDay()->format('Y-m-d');
        $rescheduleRes = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/status", [
            'status' => 'processing',
            'target_date' => $tomorrow
        ]);
        $rescheduleRes->assertStatus(200);

        // Verifikasi bahwa order dan item berpindah ke BESOK
        $order->refresh();
        $orderItem->refresh();
        $this->assertEquals($tomorrow, $order->created_at->format('Y-m-d'), 'Order harus berpindah ke tanggal besok');
        $this->assertEquals($tomorrow, $orderItem->created_at->format('Y-m-d'), 'Item order harus berpindah ke tanggal besok');
        $this->assertEquals('processing', $order->status);

        // Admin menjadwalkan pesanan ke 3 HARI LAGI
        $inThreeDays = Carbon::now('Asia/Jakarta')->addDays(3)->format('Y-m-d');
        $adminRes = $this->actingAs($this->admin)->putJson("/api/admin/orders/{$order->id}/status", [
            'status' => 'processing',
            'target_date' => $inThreeDays
        ]);
        $adminRes->assertStatus(200);

        $order->refresh();
        $this->assertEquals($inThreeDays, $order->created_at->format('Y-m-d'), 'Admin harus bisa menjadwalkan ke tanggal berapa pun');
    }

    /**
     * 6. Test Rekapan Transaksi & Finansial: Admin, Kantin, dan User
     */
    public function test_rekap_system_for_admin_canteen_and_user()
    {
        // 1. Rekap Kantin
        $canteenRecapRes = $this->actingAs($this->kantinUser)->getJson('/api/canteen/orders/recap?period=month');
        $canteenRecapRes->assertStatus(200);

        // 2. Rekap Admin (Global seluruh pondok)
        $adminRecapRes = $this->actingAs($this->admin)->getJson('/api/admin/orders/recap?period=month');
        $adminRecapRes->assertStatus(200);

        // 3. Riwayat Transaksi User/Santri
        $userOrdersRes = $this->actingAs($this->santriUser)->getJson('/api/orders?period=month');
        $userOrdersRes->assertStatus(200);
    }

    /**
     * 7. Test Alur Kurir: Ambil Pesanan, Upload Bukti Serah Terima, Selesaikan
     */
    public function test_courier_flow_take_and_complete()
    {
        // Order dibuat dan diproses
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 30000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar 07',
            'courier_id' => $this->kurirUser->id,
            'created_at' => now('Asia/Jakarta'),
            'updated_at' => now('Asia/Jakarta'),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'price' => 27000,
            'price_per_item' => 27000,
            'subtotal' => 27000,
            'created_at' => now('Asia/Jakarta'),
            'updated_at' => now('Asia/Jakarta'),
        ]);

        // Kurir lihat daftar tugasnya
        $courierOrdersRes = $this->actingAs($this->kurirUser)->getJson('/api/courier/orders');
        $courierOrdersRes->assertStatus(200);

        // Kurir upload foto serah terima santri
        $fakeDeliveryPhoto = UploadedFile::fake()->image('serah_terima_santri.jpg', 400, 600);
        $uploadDelivRes = $this->actingAs($this->kurirUser)->postJson("/api/courier/orders/{$order->id}/upload-delivery", [
            'proof_of_delivery' => [$fakeDeliveryPhoto]
        ]);
        $uploadDelivRes->assertStatus(200);

        // Kurir selesaikan pesanan
        $completeRes = $this->actingAs($this->kurirUser)->postJson("/api/courier/orders/{$order->id}/complete");
        $completeRes->assertStatus(200);

        $order->refresh();
        $this->assertEquals('completed', $order->status);
        $this->assertNotEmpty($order->proof_of_delivery);
    }

    /**
     * Test Fitur Guru / Staff Yayasan (Prioritas Antar Langsung & Bebas Blokir Profil Santri)
     */
    public function test_guru_staff_profile_and_direct_delivery_priority_order_flow(): void
    {
        // 1. Setup User Guru / Staff tanpa data santri
        $teacherUser = User::firstOrCreate(
            ['email' => 'ustadz_fauzi_test@higopondok.com'],
            ['name' => 'Ustadz Fauzi Test', 'password' => bcrypt('password')]
        );
        $teacherUser->syncRoles(['user']);

        // User biasa mencoba set diri sendiri sebagai guru (harus DITOLAK 403 sesuai mitigasi K-01)
        $selfSetRes = $this->actingAs($teacherUser)->putJson('/api/me', [
            'name' => 'Ustadz Fauzi Test',
            'phone' => '081299887711',
            'is_teacher' => true,
            'niy' => 'NIY. 1985.03.099',
            'teacher_unit' => 'SMP',
        ]);
        $selfSetRes->assertStatus(403);

        // Admin menetapkan status Guru/Staff via endpoint resmi
        $adminSetRes = $this->actingAs($this->admin)->putJson("/api/admin/users/{$teacherUser->id}/set-teacher", [
            'is_teacher' => true,
            'niy' => 'NIY. 1985.03.099',
            'teacher_unit' => 'SMP',
        ]);
        $adminSetRes->assertStatus(200);

        // Guru melengkapi nomor HP di profilnya
        $updateProfileRes = $this->actingAs($teacherUser)->putJson('/api/me', [
            'name' => 'Ustadz Fauzi Test',
            'phone' => '081299887711',
        ]);
        $updateProfileRes->assertStatus(200);

        $teacherUser->refresh();
        $this->assertTrue((bool)$teacherUser->is_teacher);
        $this->assertEquals('NIY. 1985.03.099', $teacherUser->niy);
        $this->assertEquals('SMP', $teacherUser->teacher_unit);
        $this->assertNull($teacherUser->santri_name);

        // 2. Checkout batch pesanan khusus Guru (order_for = 'guru')
        // Memastikan tidak diblokir meski profil santri kosong
        $checkoutRes = $this->actingAs($teacherUser)->postJson('/api/orders/batch', [
            'order_for' => 'guru',
            'delivery_location' => 'Ruang Guru SMP (Meja 02)',
            'canteens' => [
                [
                    'canteen_id' => $this->canteen->id,
                    'custom_notes' => 'Diantar langsung ke ruang guru',
                    'items' => [
                        [
                            'product_id' => $this->product->id,
                            'quantity' => 1,
                        ]
                    ]
                ]
            ]
        ]);

        $checkoutRes->assertStatus(201);
        $createdOrder = Order::where('user_id', $teacherUser->id)->latest('id')->first();
        $this->assertNotNull($createdOrder);
        $this->assertEquals('guru', $createdOrder->order_for);
        $this->assertTrue((bool)$createdOrder->is_priority);
        $this->assertEquals('Ruang Guru SMP (Meja 02)', $createdOrder->delivery_location);

        // 3. Kantin menugaskan kurir untuk mengantar pesanan prioritas guru
        $createdOrder->update([
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing'
        ]);

        // Kurir melihat pesanan prioritas di daftarnya
        $courierRes = $this->actingAs($this->kurirUser)->getJson('/api/courier/orders');
        $courierRes->assertStatus(200);
        $ordersList = $courierRes->json();
        $this->assertTrue(collect($ordersList)->contains('id', $createdOrder->id));
    }
}
