<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;

class OrderLifecycle_Phase4_CourierDeliveryTest extends TestCase
{
    use DatabaseTransactions;

    protected $canteenUser;
    protected $canteen;
    protected $courierUser;
    protected $otherCourierUser;
    protected $santriUser;
    protected $product;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->canteenUser = User::firstOrCreate(
            ['email' => 'canteen_phase4@higopondok.com'],
            ['name' => 'Owner Phase 4', 'password' => bcrypt('password')]
        );
        $this->canteenUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->canteenUser->id],
            [
                'name' => 'Toko Kurir Phase 4',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
                'balance' => 0,
            ]
        );
        $this->canteen->update(['balance' => 0, 'sold_count' => 0]);

        $this->courierUser = User::firstOrCreate(
            ['email' => 'courier_phase4_a@higopondok.com'],
            ['name' => 'Kurir Phase 4 A', 'password' => bcrypt('password')]
        );
        $this->courierUser->syncRoles(['kurir']);
        $this->courierUser->update(['balance' => 0]);
        $this->courierUser->assignedCanteens()->sync([$this->canteen->id]);

        $this->otherCourierUser = User::firstOrCreate(
            ['email' => 'courier_phase4_b@higopondok.com'],
            ['name' => 'Kurir Phase 4 B', 'password' => bcrypt('password')]
        );
        $this->otherCourierUser->syncRoles(['kurir']);
        $this->otherCourierUser->update(['balance' => 0]);

        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_phase4@higopondok.com'],
            [
                'name' => 'Wali Phase 4',
                'password' => bcrypt('password'),
                'phone' => '081234567444',
                'santri_name' => 'Santri Phase 4',
                'santri_room' => 'Kamar Usman 01',
                'santri_class' => '12 IPA',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->syncRoles(['user']);

        $this->product = Product::create([
            'canteen_id' => $this->canteen->id,
            'name' => 'Paket Hemat Kurir',
            'price' => 20000,
            'hpp' => 15000,
            'stock' => 10,
            'sold_count' => 0,
            'is_available' => true,
            'category' => 'makanan',
        ]);
    }

    public function test_courier_orders_list_shows_processing_orders()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-COURIER-01',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->courierUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 24000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'canteen_income' => 20000,
            'delivery_location' => 'Kamar Usman 01',
        ]);

        $res = $this->actingAs($this->courierUser)->getJson('/api/courier/orders');
        $res->assertStatus(200);

        $orders = $res->json('data') ?: $res->json();
        $this->assertTrue(collect($orders)->contains('id', $order->id));

        // Kurir lain yang tidak ditugaskan tidak boleh melihat pesanan ini dalam scope assigned
        $otherRes = $this->actingAs($this->otherCourierUser)->getJson('/api/courier/orders?scope=assigned');
        $otherRes->assertStatus(200);
        $otherOrders = $otherRes->json('data') ?: $otherRes->json();
        $this->assertFalse(collect($otherOrders)->contains('id', $order->id));
    }

    public function test_courier_completing_order_updates_status_balances_and_stock()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-COURIER-COMPLETE',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->courierUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 24000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'canteen_income' => 20000,
            'delivery_location' => 'Kamar Usman 01',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'price' => 20000,
            'subtotal' => 40000,
        ]);

        $res = $this->actingAs($this->courierUser)->postJson("/api/courier/orders/{$order->id}/complete");
        $res->assertStatus(200);

        $order->refresh();
        $this->assertEquals('completed', $order->status);

        // Saldo kantin bertambah sesuai canteen_income (HPJ 40.000 - HPP 30.000 = 10.000)
        $this->canteen->refresh();
        $this->assertEquals(10000, (float) $this->canteen->balance);

        // Saldo kurir bertambah sesuai ongkir
        $this->courierUser->refresh();
        $this->assertEquals(3000, (float) $this->courierUser->balance);

        // Stok produk berkurang 2
        $this->product->refresh();
        $this->assertEquals(8, $this->product->stock);
    }

    public function test_order_completed_notification_only_sent_to_customer_and_not_to_canteen()
    {
        \Illuminate\Support\Facades\Mail::fake();

        $order = Order::create([
            'checkout_id' => 'CHK-NOTIF-TEST',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->courierUser->id,
            'status' => 'completed',
            'payment_status' => 'paid',
            'total_price' => 24000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'canteen_income' => 20000,
            'delivery_location' => 'Kamar Usman 01',
        ]);

        (new \App\Domains\Canteen\Jobs\SendOrderCompletedNotificationJob($order->id))->handle();

        \Illuminate\Support\Facades\Mail::assertSent(\App\Domains\Canteen\Mail\CustomerOrderCompletedMail::class, function ($mail) {
            return $mail->hasTo($this->santriUser->email);
        });

        \Illuminate\Support\Facades\Mail::assertNotSent(\App\Domains\Canteen\Mail\CanteenOrderCompletedMail::class);
    }
}

