<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;

class OrderLifecycle_Phase2_AdminManagementTest extends TestCase
{
    use DatabaseTransactions;

    protected $adminUser;
    protected $santriUser;
    protected $courierUser;
    protected $canteen;
    protected $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::firstOrCreate(
            ['email' => 'superadmin@higopondok.id'],
            ['name' => 'Super Administrator', 'password' => bcrypt('password')]
        );
        $this->adminUser->syncRoles(['super_admin', 'admin']);

        $this->courierUser = User::firstOrCreate(
            ['email' => 'courier_admin_test@higopondok.com'],
            ['name' => 'Kurir Phase 2', 'password' => bcrypt('password'), 'phone' => '089999999991']
        );
        $this->courierUser->syncRoles(['kurir']);

        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_phase2@higopondok.com'],
            [
                'name' => 'Wali Phase 2',
                'password' => bcrypt('password'),
                'phone' => '081234567888',
                'santri_name' => 'Santri Phase 2',
                'santri_room' => 'Kamar Abu Bakar 05',
                'santri_class' => '10 MIPA',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->syncRoles(['user']);

        $owner = User::firstOrCreate(
            ['email' => 'owner_phase2@higopondok.com'],
            ['name' => 'Owner Phase 2', 'password' => bcrypt('password')]
        );
        $owner->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $owner->id],
            [
                'name' => 'Kantin Admin Test',
                'category' => 'canteen',
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
                'delivery_fee' => 3000,
                'platform_fee' => 1000,
            ]
        );

        // Assign courier ke kantin
        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $this->canteen->id, 'courier_id' => $this->courierUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $this->product = Product::create([
            'canteen_id' => $this->canteen->id,
            'name' => 'Sate Ayam Phase 2',
            'price' => 20000,
            'hpp' => 15000,
            'stock' => 50,
            'is_available' => true,
            'category' => 'makanan',
        ]);
    }

    public function test_admin_can_retrieve_orders_list_with_relations()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-TEST-PHASE2-01',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 24000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 05',
        ]);

        $res = $this->actingAs($this->adminUser)->getJson('/api/admin/orders');
        $res->assertStatus(200);

        $data = $res->json('data') ?: $res->json();
        $this->assertIsArray($data);
        $this->assertTrue(collect($data)->contains('id', $order->id));
    }

    public function test_admin_marking_paid_automatically_advances_pending_order_to_processing_and_assigns_courier()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-TEST-PHASE2-AUTO',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => null,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 24000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 05',
        ]);

        // Admin hanya mengubah payment_status menjadi 'paid'
        $payload = [
            'payment_status' => 'paid',
        ];

        $res = $this->actingAs($this->adminUser)->putJson("/api/admin/orders/{$order->id}/status", $payload);
        $res->assertStatus(200);

        $order->refresh();
        $this->assertEquals('paid', $order->payment_status);
        // Status otomatis menjadi processing dan kurir ditugaskan otomatis
        $this->assertEquals('processing', $order->status);
        $this->assertEquals($this->courierUser->id, $order->courier_id);
    }

    public function test_admin_batch_update_status_and_payment_for_entire_wadah()
    {
        $order1 = Order::create([
            'checkout_id' => 'CHK-BATCH-PHASE2',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 24000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 05',
        ]);

        $order2 = Order::create([
            'checkout_id' => 'CHK-BATCH-PHASE2',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 15000,
            'delivery_fee' => 2000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 05',
        ]);

        $payload = [
            'order_ids' => [$order1->id, $order2->id],
            'payment_status' => 'paid',
        ];

        $res = $this->actingAs($this->adminUser)->postJson('/api/admin/orders/batch-status', $payload);
        $res->assertStatus(200);

        $order1->refresh();
        $order2->refresh();

        $this->assertEquals('paid', $order1->payment_status);
        $this->assertEquals('paid', $order2->payment_status);
        $this->assertEquals('processing', $order1->status);
        $this->assertEquals('processing', $order2->status);
        $this->assertEquals($this->courierUser->id, $order1->courier_id);
        $this->assertEquals($this->courierUser->id, $order2->courier_id);
    }

    public function test_admin_updating_single_store_order_does_not_affect_other_store_in_same_checkout_batch()
    {
        $owner2 = User::firstOrCreate(
            ['email' => 'owner2_phase2@higopondok.com'],
            ['name' => 'Owner Toko 2', 'password' => bcrypt('password')]
        );
        $owner2->syncRoles(['kantin']);

        $canteen2 = Canteen::firstOrCreate(
            ['user_id' => $owner2->id],
            [
                'name' => 'Kantin Martabak Test',
                'category' => 'canteen',
                'status' => 'approved',
                'delivery_fee' => 2000,
                'platform_fee' => 1000,
            ]
        );

        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $canteen2->id, 'courier_id' => $this->courierUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $checkoutId = 'CHK-MULTI-STORE-TEST-' . time();
        $orderMomoyo = Order::create([
            'checkout_id' => $checkoutId,
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 16000,
            'delivery_fee' => 1500,
            'admin_fee' => 3500,
            'delivery_location' => 'Kamar Abu Bakar 05',
            'created_at' => now('Asia/Jakarta'),
        ]);

        $orderMartabak = Order::create([
            'checkout_id' => $checkoutId,
            'user_id' => $this->santriUser->id,
            'canteen_id' => $canteen2->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 31000,
            'delivery_fee' => 1500,
            'admin_fee' => 3500,
            'delivery_location' => 'Kamar Abu Bakar 05',
            'created_at' => now('Asia/Jakarta'),
        ]);

        $originalMartabakDate = $orderMartabak->created_at->toDateTimeString();

        // 1. Admin secara khusus mengubah status & bayar hanya pada Momoyo
        $res = $this->actingAs($this->adminUser)->putJson("/api/admin/orders/{$orderMomoyo->id}/status", [
            'status' => 'processing',
            'payment_status' => 'paid',
        ]);
        $res->assertStatus(200);

        $orderMomoyo->refresh();
        $orderMartabak->refresh();

        // Momoyo harus berubah menjadi processing & paid
        $this->assertEquals('processing', $orderMomoyo->status);
        $this->assertEquals('paid', $orderMomoyo->payment_status);

        // Martabak HARUS TETAP pending & unpaid (tidak boleh ikut bergerak)
        $this->assertEquals('pending', $orderMartabak->status);
        $this->assertEquals('unpaid', $orderMartabak->payment_status);

        // 2. Admin menjadwalkan pesanan Momoyo ke besok
        $tomorrowDate = now('Asia/Jakarta')->addDay()->toDateString();
        $resDate = $this->actingAs($this->adminUser)->putJson("/api/admin/orders/{$orderMomoyo->id}/status", [
            'target_date' => $tomorrowDate,
        ]);
        $resDate->assertStatus(200);

        $orderMomoyo->refresh();
        $orderMartabak->refresh();

        // Tanggal Momoyo berubah ke besok
        $this->assertEquals($tomorrowDate, $orderMomoyo->created_at->toDateString());
        // Tanggal Martabak HARUS TETAP tanggal aslinya (tidak ikut bergeser ke besok)
        $this->assertEquals($originalMartabakDate, $orderMartabak->created_at->toDateTimeString());
    }
}
