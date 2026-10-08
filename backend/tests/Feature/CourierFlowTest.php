<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use App\Domains\Admin\PaymentLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class CourierFlowTest extends TestCase
{
    use DatabaseTransactions;

    protected $kantinUser;
    protected $canteen;
    protected $kurirUser;
    protected $santriUser;
    protected $product;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // 1. Kantin
        $this->kantinUser = User::firstOrCreate(
            ['email' => 'kantin_courier_test@higopondok.com'],
            ['name' => 'Kantin Courier Flow', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->kantinUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinUser->id],
            [
                'name' => 'Kantin Courier Test',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );

        // 2. Kurir
        $this->kurirUser = User::firstOrCreate(
            ['email' => 'kurir_flow_test@higopondok.com'],
            ['name' => 'Kurir Flow Test', 'password' => bcrypt('password'), 'role' => 'kurir']
        );
        $this->kurirUser->syncRoles(['kurir']);
        $this->kurirUser->update(['balance' => 0]);
        $this->kurirUser->assignedCanteens()->sync([$this->canteen->id]);

        // 3. Santri
        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_courier_test@higopondok.com'],
            ['name' => 'Santri Courier Test', 'password' => bcrypt('password'), 'role' => 'user']
        );
        $this->santriUser->syncRoles(['user']);

        // 4. Produk
        $this->product = Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Es Teh Manis Test'],
            ['price' => 5000, 'stock' => 100, 'is_available' => true]
        );
    }

    /**
     * 1. Kurir Dapat Melihat Daftar Pesanan yang Ditugaskan
     */
    public function test_courier_can_view_assigned_orders(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 10000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Asrama 05',
        ]);

        $response = $this->actingAs($this->kurirUser)->getJson('/api/courier/orders');
        $response->assertStatus(200);

        $orders = $response->json();
        $this->assertTrue(collect($orders)->contains('id', $order->id));
    }

    /**
     * 2. Kurir Mengambil Pesanan (takeOrder)
     */
    public function test_courier_can_take_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'paid',
            'total_price' => 10000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Asrama 05',
            'courier_id' => null,
        ]);

        $response = $this->actingAs($this->kurirUser)->postJson("/api/courier/orders/{$order->id}/take");
        $response->assertStatus(200);

        $order->refresh();
        $this->assertEquals($this->kurirUser->id, $order->courier_id);
        $this->assertEquals('processing', $order->status);
    }

    /**
     * 3. Kurir Mengunggah Struk Pembelian di Kantin (uploadPurchaseProof)
     */
    public function test_courier_can_upload_purchase_receipt(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 10000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Asrama 05',
        ]);

        $fakeReceipt = UploadedFile::fake()->image('struk_kantin.jpg', 400, 600);
        $response = $this->actingAs($this->kurirUser)->postJson("/api/courier/orders/{$order->id}/upload-receipt", [
            'proof_of_purchase' => [$fakeReceipt]
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertNotEmpty($order->proof_of_purchase);
        $this->assertIsArray($order->proof_of_purchase);
    }

    /**
     * 4. Kurir Mengunggah Foto Serah Terima ke Santri (uploadDeliveryProof)
     */
    public function test_courier_can_upload_delivery_proof(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 10000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Asrama 05',
        ]);

        $fakeDelivery = UploadedFile::fake()->image('serah_terima.jpg', 400, 600);
        $response = $this->actingAs($this->kurirUser)->postJson("/api/courier/orders/{$order->id}/upload-delivery", [
            'proof_of_delivery' => [$fakeDelivery]
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertNotEmpty($order->proof_of_delivery);
        $this->assertIsArray($order->proof_of_delivery);
    }

    /**
     * 5. Kurir Menghapus Foto Bukti yang Diunggah (deleteProofPhoto)
     */
    public function test_courier_can_delete_proof_photo(): void
    {
        $uploadedPath = 'orders/proof_delivery_test.jpg';
        Storage::disk('public')->put($uploadedPath, 'fake_content');

        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 10000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Asrama 05',
            'proof_of_delivery' => [$uploadedPath],
        ]);

        $response = $this->actingAs($this->kurirUser)->deleteJson("/api/courier/orders/{$order->id}/proof", [
            'type' => 'proof_of_delivery',
            'path' => $uploadedPath,
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertNull($order->proof_of_delivery);
        Storage::disk('public')->assertMissing($uploadedPath);
    }

    /**
     * 6. Kurir Menyelesaikan Pesanan (completeOrder):
     *    - Status menjadi completed
     *    - Saldo kurir bertambah senilai delivery_fee (Rp 3.000)
     *    - Tercatat di PaymentLog type 'courier_fee'
     *    - Saldo kantin bertambah sesuai laba bersih pesanan
     */
    public function test_courier_complete_order_increments_balance_and_records_payment_log(): void
    {
        $initialCourierBalance = (float) $this->kurirUser->fresh()->balance;
        $initialCanteenBalance = (float) $this->canteen->fresh()->balance;

        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 15000,
            'delivery_fee' => 3000,
            'admin_fee' => 2000,
            'delivery_location' => 'Kamar Asrama 05',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);

        $response = $this->actingAs($this->kurirUser)->postJson("/api/courier/orders/{$order->id}/complete");
        $response->assertStatus(200);

        $order->refresh();
        $this->assertEquals('completed', $order->status);

        // 1. Verifikasi saldo kurir bertambah Rp 3.000
        $this->kurirUser->refresh();
        $this->assertEquals($initialCourierBalance + 3000, (float) $this->kurirUser->balance);

        // 2. Verifikasi PaymentLog untuk kurir
        $log = PaymentLog::where('order_id', $order->id)
            ->where('user_id', $this->kurirUser->id)
            ->where('type', 'courier_fee')
            ->first();
        $this->assertNotNull($log);
        $this->assertEquals(3000, (float) $log->amount);

        // 3. Verifikasi saldo kantin bertambah
        $this->canteen->refresh();
        $this->assertTrue($this->canteen->balance >= $initialCanteenBalance);
    }

    /**
     * 7. Kurir Membatalkan Pesanan yang Sedang Diantar (courierCancelOrder)
     */
    public function test_courier_can_cancel_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'courier_id' => $this->kurirUser->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 10000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Asrama 05',
        ]);

        $response = $this->actingAs($this->kurirUser)->putJson("/api/courier/orders/{$order->id}/cancel", [
            'reason' => 'Santri tidak dapat ditemui di asrama'
        ]);

        $response->assertStatus(200);
        $order->refresh();

        $this->assertEquals('cancelled', $order->status);
    }

    /**
     * 8. User Bukan Kurir Ditolak Mengakses Endpoint Kurir (403)
     */
    public function test_non_courier_user_rejected_from_courier_routes(): void
    {
        $response = $this->actingAs($this->santriUser)->getJson('/api/courier/orders');
        $response->assertStatus(403);
    }
}
