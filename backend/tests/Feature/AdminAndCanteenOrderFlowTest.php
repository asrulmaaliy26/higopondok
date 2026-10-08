<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class AdminAndCanteenOrderFlowTest extends TestCase
{
    use DatabaseTransactions;

    protected $admin;
    protected $kantinUser;
    protected $canteen;
    protected $otherKantinUser;
    protected $otherCanteen;
    protected $kurirUser;
    protected $santriUser;
    protected $product;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // 1. Admin
        $this->admin = User::firstOrCreate(
            ['email' => 'admin_canteen_flow@higopondok.com'],
            ['name' => 'Admin Canteen Flow', 'password' => bcrypt('password'), 'role' => 'admin']
        );
        $this->admin->syncRoles(['admin']);

        // 2. Kantin Utama
        $this->kantinUser = User::firstOrCreate(
            ['email' => 'kantin_canteen_flow@higopondok.com'],
            ['name' => 'Kantin Flow User', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->kantinUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinUser->id],
            [
                'name' => 'Kantin Utama Flow Test',
                'description' => 'Kantin Utama',
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

        // 3. Kantin Lain (untuk isolasi akses)
        $this->otherKantinUser = User::firstOrCreate(
            ['email' => 'other_kantin_flow@higopondok.com'],
            ['name' => 'Other Kantin User', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->otherKantinUser->syncRoles(['kantin']);

        $this->otherCanteen = Canteen::firstOrCreate(
            ['user_id' => $this->otherKantinUser->id],
            [
                'name' => 'Kantin Lain Flow Test',
                'description' => 'Kantin Lain',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );

        // 4. Kurir
        $this->kurirUser = User::firstOrCreate(
            ['email' => 'kurir_canteen_flow@higopondok.com'],
            ['name' => 'Kurir Flow User', 'password' => bcrypt('password'), 'role' => 'kurir']
        );
        $this->kurirUser->syncRoles(['kurir']);

        // 5. Santri
        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_canteen_flow@higopondok.com'],
            [
                'name' => 'Santri Canteen Flow',
                'password' => bcrypt('password'),
                'role' => 'user',
                'phone' => '081234567892',
                'santri_name' => 'Budi Santri',
                'santri_room' => 'Kamar Umar 02',
                'santri_class' => '11 IPS',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->update([
            'phone' => '081234567892',
            'santri_name' => 'Budi Santri',
            'santri_room' => 'Kamar Umar 02',
            'santri_class' => '11 IPS',
            'santri_level' => 'Aliyah',
        ]);
        $this->santriUser->syncRoles(['user']);

        // 6. Produk
        $this->product = Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Sate Ayam Madura Test'],
            [
                'price' => 15000,
                'stock' => 50,
                'is_available' => true,
                'category' => 'Makanan'
            ]
        );
        $this->product->update(['price' => 15000, 'stock' => 50, 'is_available' => true]);
    }

    /**
     * 1. Kantin Dapat Melihat Daftar Pesanan Miliknya
     */
    public function test_canteen_can_view_its_orders(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->kantinUser)->getJson('/api/canteen/orders');
        $response->assertStatus(200);

        $orders = $response->json();
        $this->assertTrue(collect($orders)->contains('id', $order->id));
    }

    /**
     * 2. Isolasi Akses: Pemilik Kantin B Tidak Boleh Mengubah Pesanan Kantin A (404/Abort)
     */
    public function test_canteen_cannot_manage_other_canteen_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->otherKantinUser)->putJson("/api/canteen/orders/{$order->id}/status", [
            'status' => 'processing'
        ]);

        $response->assertStatus(404);
    }

    /**
     * 3. Kantin Menentukan Harga Pesanan Khusus (setCustomOrderPrice)
     */
    public function test_canteen_can_set_custom_order_price(): void
    {
        $customOrder = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Tolong belikan termometer di apotek',
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 0,
            'admin_fee' => 2000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        // Toko menentukan harga barang = Rp 25.000
        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$customOrder->id}/custom-price", [
            'total_price' => 25000
        ]);

        $response->assertStatus(200);
        $updatedOrder = $response->json('order');

        // Total = 25000 + 2000 (admin) + 3000 (delivery) = 30000
        $this->assertEquals(30000, (float) $updatedOrder['total_price']);

        $customOrder->refresh();
        $this->assertEquals(30000, (float) $customOrder->total_price);
    }

    /**
     * 4. Kantin Menolak Ubah Harga Pesanan Khusus Jika Sudah Berstatus Lunas (paid)
     */
    public function test_canteen_cannot_set_custom_price_if_already_paid(): void
    {
        $paidOrder = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Pesanan Khusus',
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 25000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$paidOrder->id}/custom-price", [
            'total_price' => 35000
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment([
            'message' => 'Pesanan sudah berstatus Lunas, harga tidak dapat diubah lagi.'
        ]);
    }

    /**
     * 5. Kantin Konfirmasi Status Pembayaran (updatePaymentStatus ke 'paid') & Sinkronisasi Checkout
     */
    public function test_canteen_can_confirm_payment_and_syncs_linked_orders(): void
    {
        $chkId = 'CHK-PAY-' . uniqid();
        $order1 = Order::create([
            'checkout_id' => $chkId,
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'waiting_confirmation',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);
        $order2 = Order::create([
            'checkout_id' => $chkId,
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'waiting_confirmation',
            'total_price' => 15000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order1->id}/payment", [
            'payment_status' => 'paid'
        ]);

        $response->assertStatus(200);
        $order1->refresh();
        $order2->refresh();

        $this->assertEquals('paid', $order1->payment_status);
        $this->assertEquals('paid', $order2->payment_status, 'Order kedua dalam checkout yang sama harus otomatis ikut lunas');
    }

    /**
     * 6. Kantin Gagal Melanjutkan Pesanan ke Kurir (processing) Jika Toko Belum Ada Kurir yang Ditugaskan
     */
    public function test_canteen_cannot_process_order_if_no_courier_assigned(): void
    {
        // Pastikan tidak ada kurir untuk canteen ini di tabel pivot
        DB::table('canteen_couriers')->where('canteen_id', $this->canteen->id)->delete();

        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/status", [
            'status' => 'processing'
        ]);

        $response->assertStatus(422);
        $this->assertEquals('NO_COURIER_ASSIGNED', $response->json('error_code'));
    }

    /**
     * 7. Kantin Melanjutkan Pesanan ke Kurir (processing) Otomatis Menugaskan Kurir yang Terdaftar
     */
    public function test_canteen_advances_order_to_processing_auto_assigns_courier(): void
    {
        // Daftarkan kurir ke kantin
        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $this->canteen->id, 'courier_id' => $this->kurirUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/status", [
            'status' => 'processing'
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertEquals('processing', $order->status);
        $this->assertEquals($this->kurirUser->id, $order->courier_id);
    }

    /**
     * 8. Kantin Menjadwalkan Pesanan ke Besok (target_date)
     */
    public function test_canteen_can_reschedule_order_to_tomorrow(): void
    {
        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $this->canteen->id, 'courier_id' => $this->kurirUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $tomorrow = Carbon::now('Asia/Jakarta')->addDay()->format('Y-m-d');
        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/status", [
            'status' => 'processing',
            'target_date' => $tomorrow
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertEquals($tomorrow, $order->created_at->format('Y-m-d'));
        $this->assertEquals('processing', $order->status);
    }

    /**
     * 9. Batch Update Order Status oleh Kantin / Admin
     */
    public function test_canteen_can_batch_update_orders_status(): void
    {
        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $this->canteen->id, 'courier_id' => $this->kurirUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $order1 = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Umar 02',
        ]);
        $order2 = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 15000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        $response = $this->actingAs($this->kantinUser)->putJson('/api/canteen/orders/batch-status', [
            'order_ids' => [$order1->id, $order2->id],
            'status' => 'processing',
        ]);

        $response->assertStatus(200);
        $this->assertEquals(2, $response->json('success_count'));

        $order1->refresh();
        $order2->refresh();
        $this->assertEquals('processing', $order1->status);
        $this->assertEquals('processing', $order2->status);
    }

    /**
     * 10. Kantin Membatalkan Pesanan Pending (Restores Product Stock)
     */
    public function test_canteen_can_cancel_pending_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 15000,
            'delivery_location' => 'Kamar Umar 02',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'price' => 15000,
            'subtotal' => 30000,
        ]);

        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/cancel");
        $response->assertStatus(200);

        $order->refresh();
        $this->assertEquals('cancelled', $order->status);
    }

    /**
     * 11. Kantin Menyelesaikan Pesanan Langsung (Tanpa Kurir) dengan Bukti Serah Terima
     */
    public function test_canteen_can_complete_order_directly_without_courier(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 20000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Umar 02',
            'courier_id' => null, // Tanpa kurir (diantar sendiri oleh kantin)
        ]);

        $fakeProof = UploadedFile::fake()->image('antar_langsung.jpg', 600, 800);
        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/complete", [
            'proof_of_delivery' => [$fakeProof]
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertEquals('completed', $order->status);
        $this->assertEquals('paid', $order->payment_status);
        $this->assertNotEmpty($order->proof_of_delivery);
    }

    /**
     * 12. Admin Dapat Melihat Pesanan dari SEMUA TOKO Lengkap dengan Info Pemilik Kantin
     */
    public function test_admin_can_view_orders_from_all_canteens_with_canteen_owner_details(): void
    {
        // Pesanan 1 di Kantin 1 (milik kantinUser)
        $order1 = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 25000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Abu Bakar 01',
        ]);

        // Pesanan 2 di Kantin 2 (milik otherKantinUser)
        $order2 = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->otherCanteen->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 40000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Ali 03',
        ]);

        // Admin memanggil /api/canteen/orders (tanpa filter toko / toko-saya pesanan)
        $response = $this->actingAs($this->admin)->getJson('/api/canteen/orders');
        $response->assertStatus(200);

        $data = $response->json();
        $this->assertIsArray($data);

        // Pastikan kedua pesanan dari toko yang berbeda muncul untuk admin
        $orderIds = collect($data)->pluck('id')->toArray();
        $this->assertContains($order1->id, $orderIds);
        $this->assertContains($order2->id, $orderIds);

        // Pastikan info canteen dan canteen.user ada dan akurat
        $foundOrder1 = collect($data)->firstWhere('id', $order1->id);
        $this->assertNotNull($foundOrder1['canteen']);
        $this->assertEquals($this->canteen->name, $foundOrder1['canteen']['name']);
        $this->assertNotNull($foundOrder1['canteen']['user']);
        $this->assertEquals($this->kantinUser->name, $foundOrder1['canteen']['user']['name']);

        $foundOrder2 = collect($data)->firstWhere('id', $order2->id);
        $this->assertNotNull($foundOrder2['canteen']);
        $this->assertEquals($this->otherCanteen->name, $foundOrder2['canteen']['name']);
        $this->assertNotNull($foundOrder2['canteen']['user']);
        $this->assertEquals($this->otherKantinUser->name, $foundOrder2['canteen']['user']['name']);
    }
}
