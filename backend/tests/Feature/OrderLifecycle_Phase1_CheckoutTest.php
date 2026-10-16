<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;

class OrderLifecycle_Phase1_CheckoutTest extends TestCase
{
    use DatabaseTransactions;

    protected $user;
    protected $canteenA;
    protected $canteenB;
    protected $productA;
    protected $productB;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();

        // 1. Santri User dengan Profil Lengkap
        $this->user = User::firstOrCreate(
            ['email' => 'santri_phase1@higopondok.com'],
            [
                'name' => 'Wali Santri Phase 1',
                'password' => bcrypt('password'),
                'phone' => '081234567899',
                'santri_name' => 'Santri Lifecycle 1',
                'santri_room' => 'Kamar Umar 02',
                'santri_class' => '11 IPS',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->user->update([
            'phone' => '081234567899',
            'santri_name' => 'Santri Lifecycle 1',
            'santri_room' => 'Kamar Umar 02',
            'santri_class' => '11 IPS',
            'santri_level' => 'Aliyah',
        ]);
        $this->user->syncRoles(['user']);

        // 2. Canteen A (Approved & Open 24 Jam)
        $ownerA = User::firstOrCreate(
            ['email' => 'owner_phase1_a@higopondok.com'],
            ['name' => 'Owner Phase1 A', 'password' => bcrypt('password')]
        );
        $ownerA->syncRoles(['kantin']);

        $this->canteenA = Canteen::firstOrCreate(
            ['user_id' => $ownerA->id],
            [
                'name' => 'Toko Berkah Phase 1 A',
                'category' => 'canteen',
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
                'delivery_fee' => 3000,
                'platform_fee' => 1000,
            ]
        );
        $this->canteenA->update([
            'status' => 'approved',
            'open_time' => '00:00:00',
            'close_time' => '23:59:59'
        ]);

        $this->productA = Product::create([
            'canteen_id' => $this->canteenA->id,
            'name' => 'Nasi Ayam Geprek Phase 1',
            'price' => 15000,
            'hpp' => 12000,
            'stock' => 50,
            'is_available' => true,
            'category' => 'makanan',
        ]);

        // 3. Canteen B (Approved & Open 24 Jam)
        $ownerB = User::firstOrCreate(
            ['email' => 'owner_phase1_b@higopondok.com'],
            ['name' => 'Owner Phase1 B', 'password' => bcrypt('password')]
        );
        $ownerB->syncRoles(['kantin']);

        $this->canteenB = Canteen::firstOrCreate(
            ['user_id' => $ownerB->id],
            [
                'name' => 'Kedai Minuman Phase 1 B',
                'category' => 'canteen',
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
                'delivery_fee' => 2000,
                'platform_fee' => 1000,
            ]
        );
        $this->canteenB->update([
            'status' => 'approved',
            'open_time' => '00:00:00',
            'close_time' => '23:59:59'
        ]);

        $this->productB = Product::create([
            'canteen_id' => $this->canteenB->id,
            'name' => 'Es Teh Manis Jumbo Phase 1',
            'price' => 5000,
            'hpp' => 3000,
            'stock' => 100,
            'is_available' => true,
            'category' => 'minuman',
        ]);
    }

    public function test_user_can_perform_single_store_checkout()
    {
        $payload = [
            'canteen_id' => $this->canteenA->id,
            'items' => [
                [
                    'product_id' => $this->productA->id,
                    'quantity' => 2,
                    'notes' => 'Pedas level 3',
                ]
            ],
            'delivery_location' => 'Kamar Umar 02',
            'recipient_santri_name' => 'Santri Lifecycle 1',
            'recipient_phone' => '081234567899',
        ];

        $res = $this->actingAs($this->user)->postJson('/api/orders', $payload);
        $res->assertStatus(201);
        $order = $res->json('order');

        $this->assertNotNull($order['id']);
        $this->assertEquals('pending', $order['status']);
        $this->assertEquals('unpaid', $order['payment_status']);
        $this->assertEquals(30000, $order['items'][0]['subtotal']);
        $this->assertGreaterThan(30000, $order['total_price']);
    }

    public function test_user_can_perform_multi_store_batch_checkout_with_unified_checkout_id()
    {
        $payload = [
            'canteens' => [
                [
                    'canteen_id' => $this->canteenA->id,
                    'items' => [
                        ['product_id' => $this->productA->id, 'quantity' => 1, 'notes' => 'Paha atas']
                    ]
                ],
                [
                    'canteen_id' => $this->canteenB->id,
                    'items' => [
                        ['product_id' => $this->productB->id, 'quantity' => 2, 'notes' => 'Sedikit gula']
                    ]
                ]
            ],
            'delivery_location' => 'Kamar Umar 02',
        ];

        $res = $this->actingAs($this->user)->postJson('/api/orders/batch', $payload);
        $res->assertStatus(201);

        $orders = $res->json('orders');
        $this->assertCount(2, $orders);

        // Kedua pesanan harus memiliki checkout_id yang sama persis
        $this->assertNotEmpty($orders[0]['checkout_id']);
        $this->assertEquals($orders[0]['checkout_id'], $orders[1]['checkout_id']);
        $this->assertEquals('pending', $orders[0]['status']);
        $this->assertEquals('pending', $orders[1]['status']);
    }

    public function test_order_recipient_snapshot_is_preserved_when_user_switches_profile_for_different_santri()
    {
        // 1. Set profil awal untuk Santri Pertama
        $this->user->update([
            'santri_name' => 'Ahmad Santri Pertama',
            'santri_room' => 'Kamar Abu Bakar 01',
            'santri_class' => '7A',
            'santri_level' => 'SMP',
            'phone' => '628111111111',
        ]);

        // 2. User memesan pesanan pertama (Order 1)
        $payload1 = [
            'canteens' => [
                [
                    'canteen_id' => $this->canteenA->id,
                    'items' => [
                        ['product_id' => $this->productA->id, 'quantity' => 1]
                    ]
                ]
            ],
            'delivery_location' => 'Kamar Abu Bakar 01',
            'order_for' => 'santri',
        ];

        $res1 = $this->actingAs($this->user)->postJson('/api/orders/batch', $payload1);
        $res1->assertStatus(201);
        $order1Id = $res1->json('orders.0.id');
        $this->assertNotNull($order1Id);

        // Ambil order 1 langsung dari DB
        $order1 = Order::findOrFail($order1Id);
        $this->assertEquals('Ahmad Santri Pertama', $order1->recipient_santri_name);
        $this->assertEquals('Kamar Abu Bakar 01', $order1->recipient_santri_room);
        $this->assertEquals('7A', $order1->recipient_santri_class);
        $this->assertEquals('SMP', $order1->recipient_santri_level);
        $this->assertEquals('628111111111', $order1->recipient_phone);
        $this->assertEquals('Kamar Abu Bakar 01', $order1->delivery_location);

        // 3. User mengubah profil untuk memesan bagi Santri Kedua yang berbeda (via PUT /api/me)
        $updateProfileRes = $this->actingAs($this->user)->putJson('/api/me', [
            'santri_name' => 'Zaid Santri Kedua',
            'santri_room' => 'Kamar Utsman 04',
            'santri_class' => '8B',
            'santri_level' => 'SMP',
            'phone' => '628222222222',
        ]);
        $updateProfileRes->assertStatus(200);

        // Pastikan tabel users terupdate
        $this->user->refresh();
        $this->assertEquals('Zaid Santri Kedua', $this->user->santri_name);
        $this->assertEquals('Kamar Utsman 04', $this->user->santri_room);

        // 4. User memesan pesanan kedua (Order 2) untuk Santri Kedua
        $payload2 = [
            'canteens' => [
                [
                    'canteen_id' => $this->canteenB->id,
                    'items' => [
                        ['product_id' => $this->productB->id, 'quantity' => 2]
                    ]
                ]
            ],
            'delivery_location' => 'Kamar Utsman 04',
            'order_for' => 'santri',
        ];

        $res2 = $this->actingAs($this->user)->postJson('/api/orders/batch', $payload2);
        $res2->assertStatus(201);
        $order2Id = $res2->json('orders.0.id');
        $this->assertNotNull($order2Id);

        // 5. Verifikasi Order 2 memiliki snapshot data Santri Kedua
        $order2 = Order::findOrFail($order2Id);
        $this->assertEquals('Zaid Santri Kedua', $order2->recipient_santri_name);
        $this->assertEquals('Kamar Utsman 04', $order2->recipient_santri_room);
        $this->assertEquals('8B', $order2->recipient_santri_class);
        $this->assertEquals('SMP', $order2->recipient_santri_level);
        $this->assertEquals('628222222222', $order2->recipient_phone);
        $this->assertEquals('Kamar Utsman 04', $order2->delivery_location);

        // 6. UJI UTAMA: Verifikasi pesanan lama (Order 1) TETAP UTUH & TIDAK BERUBAH SAMA SEKALI
        $order1Fresh = Order::findOrFail($order1Id);
        $this->assertEquals('Ahmad Santri Pertama', $order1Fresh->recipient_santri_name);
        $this->assertEquals('Kamar Abu Bakar 01', $order1Fresh->recipient_santri_room);
        $this->assertEquals('7A', $order1Fresh->recipient_santri_class);
        $this->assertEquals('SMP', $order1Fresh->recipient_santri_level);
        $this->assertEquals('628111111111', $order1Fresh->recipient_phone);
        $this->assertEquals('Kamar Abu Bakar 01', $order1Fresh->delivery_location);

        // 7. Verifikasi pemanggilan API GET /api/orders mengembalikan data penerima masing-masing dengan akurat
        $ordersListRes = $this->actingAs($this->user)->getJson('/api/orders');
        $ordersListRes->assertStatus(200);
        $userOrdersList = collect($ordersListRes->json());

        $returnedOrder1 = $userOrdersList->firstWhere('id', $order1Id);
        $returnedOrder2 = $userOrdersList->firstWhere('id', $order2Id);

        $this->assertNotNull($returnedOrder1);
        $this->assertNotNull($returnedOrder2);
        $this->assertEquals('Ahmad Santri Pertama', $returnedOrder1['recipient_santri_name']);
        $this->assertEquals('Kamar Abu Bakar 01', $returnedOrder1['recipient_santri_room']);
        $this->assertEquals('Zaid Santri Kedua', $returnedOrder2['recipient_santri_name']);
        $this->assertEquals('Kamar Utsman 04', $returnedOrder2['recipient_santri_room']);
    }
}

