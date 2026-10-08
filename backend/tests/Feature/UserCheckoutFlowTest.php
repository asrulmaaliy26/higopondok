<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class UserCheckoutFlowTest extends TestCase
{
    use DatabaseTransactions;

    protected $santriUser;
    protected $canteenA;
    protected $canteenB;
    protected $productA;
    protected $productB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Cache::flush();

        // 1. Santri User
        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_flow_test@higopondok.com'],
            [
                'name' => 'Ahmad Santri Flow',
                'password' => bcrypt('password'),
                'role' => 'user',
                'phone' => '081234567891',
                'santri_name' => 'Ahmad Santri',
                'santri_room' => 'Kamar Abu Bakar 01',
                'santri_class' => '10 MIPA',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->update([
            'phone' => '081234567891',
            'santri_name' => 'Ahmad Santri',
            'santri_room' => 'Kamar Abu Bakar 01',
            'santri_class' => '10 MIPA',
            'santri_level' => 'Aliyah',
        ]);
        $this->santriUser->syncRoles(['user']);

        // 2. Kantin A User & Canteen A (Open 24 Jam)
        $kantinAUser = User::firstOrCreate(
            ['email' => 'kantin_a_flow@higopondok.com'],
            ['name' => 'Owner Kantin A', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $kantinAUser->syncRoles(['kantin']);

        $this->canteenA = Canteen::firstOrCreate(
            ['user_id' => $kantinAUser->id],
            [
                'name' => 'Kantin A Flow Test',
                'description' => 'Kantin A Pengetesan Alur',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );
        $this->canteenA->update([
            'status' => 'approved',
            'open_time' => '00:00:00',
            'close_time' => '23:59:59',
        ]);

        // 3. Kantin B User & Canteen B (Open 24 Jam)
        $kantinBUser = User::firstOrCreate(
            ['email' => 'kantin_b_flow@higopondok.com'],
            ['name' => 'Owner Kantin B', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $kantinBUser->syncRoles(['kantin']);

        $this->canteenB = Canteen::firstOrCreate(
            ['user_id' => $kantinBUser->id],
            [
                'name' => 'Kantin B Flow Test',
                'description' => 'Kantin B Pengetesan Alur',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );
        $this->canteenB->update([
            'status' => 'approved',
            'open_time' => '00:00:00',
            'close_time' => '23:59:59',
        ]);

        // Products
        $this->productA = Product::firstOrCreate(
            ['canteen_id' => $this->canteenA->id, 'name' => 'Nasi Goreng Spesial Test'],
            [
                'price' => 12000,
                'stock' => 100,
                'is_available' => true,
                'category' => 'Makanan'
            ]
        );
        $this->productA->update(['price' => 12000, 'stock' => 100, 'is_available' => true]);

        $this->productB = Product::firstOrCreate(
            ['canteen_id' => $this->canteenB->id, 'name' => 'Jus Mangga Segar Test'],
            [
                'price' => 8000,
                'stock' => 50,
                'is_available' => true,
                'category' => 'Minuman'
            ]
        );
        $this->productB->update(['price' => 8000, 'stock' => 50, 'is_available' => true]);
    }

    /**
     * 1. Profil Santri Tidak Lengkap Harus Ditolak Saat Checkout (403 INCOMPLETE_PROFILE)
     */
    public function test_user_cannot_checkout_if_santri_profile_is_incomplete(): void
    {
        $incompleteUser = User::create([
            'name' => 'Santri Belum Lengkap',
            'email' => 'incomplete_' . uniqid() . '@higopondok.com',
            'password' => bcrypt('password'),
            'role' => 'user',
            'phone' => '081111222333',
            'santri_name' => null, // Kurang
            'santri_room' => null, // Kurang
        ]);
        $incompleteUser->syncRoles(['user']);

        $response = $this->actingAs($incompleteUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteenA->id,
            'delivery_location' => 'Kamar 01',
            'items' => [
                ['product_id' => $this->productA->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(403);
        $this->assertEquals('INCOMPLETE_PROFILE', $response->json('error_code'));
    }

    /**
     * 2. Checkout Reguler (1-5 Porsi) Berhasil dengan Tarif Dasar (Ongkir 3.000, Admin 2.000)
     */
    public function test_user_single_checkout_normal_quantities_calculates_base_fees(): void
    {
        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteenA->id,
            'delivery_location' => 'Kamar Abu Bakar 01',
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 2,
                    'notes' => 'Sedikit pedas'
                ]
            ]
        ]);

        $response->assertStatus(201);
        $order = $response->json('order');

        // Subtotal = 12000 * 2 = 24000
        // Base Delivery = 3000, Base Admin = 2000
        // Total = 24000 + 3000 + 2000 = 29000
        $this->assertEquals(29000, (float) $order['total_price']);
        $this->assertEquals(3000, (float) $order['delivery_fee']);
        $this->assertEquals(2000, (float) $order['admin_fee']);
        $this->assertEquals('pending', $order['status']);
        $this->assertEquals('unpaid', $order['payment_status']);
    }

    /**
     * 3. Checkout Lebih dari 5 Pesanan/Item (>5 items) Menerapkan Tarif Bertingkat (+2.000 Ongkir, +3.000 Admin)
     */
    public function test_user_checkout_more_than_5_items_applies_tiered_extra_fees(): void
    {
        // 6 item: melewati batas 5 produk -> 1 ekstra block
        // Ongkir = 3.000 + 2.000 = 5.000
        // Admin  = 2.000 + 3.000 = 5.000
        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteenA->id,
            'delivery_location' => 'Kamar Abu Bakar 01',
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 6,
                ]
            ]
        ]);

        $response->assertStatus(201);
        $order = $response->json('order');

        // Subtotal = 12000 * 6 = 72000
        // Fees = 5000 + 5000 = 10000
        // Total = 82000
        $this->assertEquals(5000, (float) $order['delivery_fee'], 'Ongkir untuk 6 item harus naik +2000');
        $this->assertEquals(5000, (float) $order['admin_fee'], 'Biaya admin untuk 6 item harus naik +3000');
        $this->assertEquals(82000, (float) $order['total_price']);
    }

    /**
     * 4. Saat Jam Tutup: Checkout Reguler Ditolak
     */
    public function test_user_cannot_checkout_regular_order_when_canteen_is_closed_by_hours(): void
    {
        // Set jam buka 01:00 sampai 01:05 (Kantin tutup saat ini)
        $this->canteenA->update([
            'open_time' => '01:00:00',
            'close_time' => '01:05:00',
        ]);
        $this->assertFalse($this->canteenA->fresh()->is_open, 'Kantin harus berstatus tutup');

        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteenA->id,
            'delivery_location' => 'Kamar Abu Bakar 01',
            'items' => [
                ['product_id' => $this->productA->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment([
            'message' => 'Maaf, Kantin sedang tutup. Tidak dapat memesan.'
        ]);
    }

    /**
     * 5. Saat Kantin Ditutup Paksa oleh Admin (Force Close): Checkout Reguler Ditolak
     */
    public function test_user_cannot_checkout_when_canteen_is_force_closed_by_admin(): void
    {
        Cache::forever('canteen_force_closed_' . $this->canteenA->id, true);
        $this->assertFalse($this->canteenA->fresh()->is_open, 'Kantin harus berstatus tutup saat di-force close');

        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteenA->id,
            'delivery_location' => 'Kamar Abu Bakar 01',
            'items' => [
                ['product_id' => $this->productA->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(400);
    }

    /**
     * 6. Pesanan Khusus (is_custom = true): Boleh Dibuat Walau Kantin Sedang Tutup, Total Price = 0 (Menunggu Toko)
     */
    public function test_user_can_checkout_custom_order_even_when_canteen_is_closed(): void
    {
        // Pastikan kantin tutup
        Cache::forever('canteen_force_closed_' . $this->canteenA->id, true);
        $this->assertFalse($this->canteenA->fresh()->is_open);

        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteenA->id,
            'delivery_location' => 'Kamar Abu Bakar 01',
            'is_custom' => true,
            'custom_notes' => 'Tolong belikan obat maag dan minyak kayu putih di apotek luar',
        ]);

        $response->assertStatus(201);
        $order = $response->json('order');

        $this->assertTrue((bool) $order['is_custom']);
        $this->assertEquals(0, (float) $order['total_price']);
        $this->assertEquals('pending', $order['status']);
        $this->assertEquals('unpaid', $order['payment_status']);
        $this->assertEquals('Tolong belikan obat maag dan minyak kayu putih di apotek luar', $order['custom_notes']);
    }

    /**
     * 7. Multi-Toko: User Membeli dari Lebih dari 1 Toko dalam 1 Keranjang Batch Checkout
     */
    public function test_user_batch_checkout_across_multiple_canteens(): void
    {
        $payload = [
            'delivery_location' => 'Kamar Abu Bakar 01',
            'canteens' => [
                [
                    'canteen_id' => $this->canteenA->id,
                    'items' => [
                        ['product_id' => $this->productA->id, 'quantity' => 2] // 2 x 12.000 = 24.000 + 5.000 fees = 29.000
                    ]
                ],
                [
                    'canteen_id' => $this->canteenB->id,
                    'items' => [
                        ['product_id' => $this->productB->id, 'quantity' => 1] // 1 x 8.000 = 8.000 + 5.000 fees = 13.000
                    ]
                ]
            ]
        ];

        $response = $this->actingAs($this->santriUser)->postJson('/api/orders/batch', $payload);
        $response->assertStatus(201);

        $checkoutId = $response->json('checkout_id');
        $orders = $response->json('orders');
        $grandTotal = $response->json('grand_total');

        $this->assertNotEmpty($checkoutId);
        $this->assertCount(2, $orders);
        $this->assertEquals(42000, (float) $grandTotal);

        // Kedua order memiliki checkout_id yang sama persis
        $this->assertEquals($checkoutId, $orders[0]['checkout_id']);
        $this->assertEquals($checkoutId, $orders[1]['checkout_id']);
    }

    /**
     * 8. Upload Bukti Pembayaran per Order Tunggal:
     *    - Mengubah payment_status menjadi waiting_confirmation
     *    - Menggeser created_at ke hari pembayaran (now)
     */
    public function test_user_can_upload_payment_proof_for_single_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteenA->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 29000,
            'delivery_fee' => 3000,
            'admin_fee' => 2000,
            'delivery_location' => 'Kamar Abu Bakar 01',
            'created_at' => now()->subDays(2),
            'updated_at' => now()->subDays(2),
        ]);

        $fakeProof = UploadedFile::fake()->image('bukti_tf.jpg', 600, 800);
        $response = $this->actingAs($this->santriUser)->postJson("/api/orders/{$order->id}/payment-proof", [
            'proof_of_payment' => [$fakeProof]
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertEquals('waiting_confirmation', $order->payment_status);
        $this->assertNotEmpty($order->proof_of_payment);
        $this->assertTrue(now('Asia/Jakarta')->isSameDay($order->created_at));
    }

    /**
     * 9. Upload Bukti Pembayaran per Checkout ID (Multi-Toko Sekaligus):
     *    - Menandai semua order dalam checkout yang sama menjadi waiting_confirmation
     */
    public function test_user_can_upload_payment_proof_by_checkout_id(): void
    {
        $chkId = 'CHK-MULTI-' . uniqid();
        $order1 = Order::create([
            'checkout_id' => $chkId,
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteenA->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 29000,
            'delivery_fee' => 3000,
            'admin_fee' => 2000,
            'delivery_location' => 'Kamar Abu Bakar 01',
        ]);
        $order2 = Order::create([
            'checkout_id' => $chkId,
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteenB->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 13000,
            'delivery_fee' => 3000,
            'admin_fee' => 2000,
            'delivery_location' => 'Kamar Abu Bakar 01',
        ]);

        $fakeProof = UploadedFile::fake()->image('bukti_batch.jpg', 600, 800);
        $response = $this->actingAs($this->santriUser)->postJson("/api/orders/checkout/{$chkId}/payment-proof", [
            'proof_of_payment' => [$fakeProof]
        ]);

        $response->assertStatus(200);
        $order1->refresh();
        $order2->refresh();

        $this->assertEquals('waiting_confirmation', $order1->payment_status);
        $this->assertEquals('waiting_confirmation', $order2->payment_status);
        $this->assertNotEmpty($order1->proof_of_payment);
        $this->assertNotEmpty($order2->proof_of_payment);
    }

    /**
     * 10. Validasi Upload Bukti Bayar: Payload Kosong / Bukan File Ditolak (422)
     */
    public function test_user_upload_payment_proof_rejects_empty_payload(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteenA->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 29000,
            'delivery_location' => 'Kamar 01',
        ]);

        $response = $this->actingAs($this->santriUser)->postJson("/api/orders/{$order->id}/payment-proof", [
            'proof_of_payment' => []
        ]);

        $response->assertStatus(422);
    }

    /**
     * 11. User Bisa Membatalkan Pesanan Miliknya Sendiri yang Masih Berstatus Pending
     */
    public function test_user_can_cancel_own_unpaid_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteenA->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 29000,
            'delivery_location' => 'Kamar Abu Bakar 01',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->productA->id,
            'quantity' => 2,
            'price' => 12000,
            'subtotal' => 24000,
        ]);

        $initialStock = $this->productA->stock;

        $response = $this->actingAs($this->santriUser)->putJson("/api/orders/{$order->id}/cancel");
        $response->assertStatus(200);

        $order->refresh();
        $this->assertEquals('cancelled', $order->status);
    }
}
