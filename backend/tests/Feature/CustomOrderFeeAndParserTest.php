<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Services\CustomOrderParserService;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class CustomOrderFeeAndParserTest extends TestCase
{
    use DatabaseTransactions;

    protected $kantinUser;
    protected $canteen;
    protected $santriUser;
    protected $kurirUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->kantinUser = User::firstOrCreate(
            ['email' => 'kantin_custom_test@higopondok.com'],
            ['name' => 'Kantin Custom Test', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->kantinUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinUser->id],
            [
                'name' => 'Kantin Custom Special',
                'description' => 'Toko Titip Beli',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );

        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_custom_test@higopondok.com'],
            [
                'name' => 'Santri Custom Test',
                'password' => bcrypt('password'),
                'role' => 'user',
                'santri_name' => 'Ahmad Custom',
                'santri_room' => 'Kamar Al-Ghazali 05',
                'santri_class' => '10A',
                'santri_level' => 'MA',
                'phone' => '081234567899'
            ]
        );
        $this->santriUser->syncRoles(['user']);

        $this->kurirUser = User::firstOrCreate(
            ['email' => 'kurir_custom_test@higopondok.com'],
            ['name' => 'Kurir Custom Test', 'password' => bcrypt('password'), 'role' => 'kurir']
        );
        $this->kurirUser->syncRoles(['kurir']);
    }

    /**
     * 1. Test CustomOrderParserService mem-parsing catatan bebas Indonesia menjadi checklist terstruktur
     */
    public function test_custom_order_parser_service_parses_indonesian_notes(): void
    {
        $parser = new CustomOrderParserService();

        // Uji kalimat acak santri dengan koma & 'sama'
        $notes = 'tolong belikan tolak angin 3 saset, sabun lifebuoy merah 1 pcs, sama roti aoka 2';
        $items = $parser->parseNotes($notes);

        $this->assertIsArray($items);
        $this->assertCount(3, $items);

        $this->assertEquals('Tolak Angin', $items[0]['item']);
        $this->assertEquals(3, $items[0]['quantity']);
        $this->assertEquals('saset', $items[0]['unit']);
        $this->assertFalse($items[0]['is_checked']);

        $this->assertStringContainsString('Sabun Lifebuoy', $items[1]['item']);
        $this->assertEquals(1, $items[1]['quantity']);

        $this->assertEquals('Roti Aoka', $items[2]['item']);
        $this->assertEquals(2, $items[2]['quantity']);

        // Uji format baris baru bernomor
        $notesNumbered = "1. Nasi Padang ayam bakar 1 bungkus\n2. Es teh manis 2 bungkus\n3. Aqua botol 600ml 1";
        $itemsNumbered = $parser->parseNotes($notesNumbered);

        $this->assertCount(3, $itemsNumbered);
        $this->assertStringContainsString('Nasi Padang', $itemsNumbered[0]['item']);
        $this->assertEquals('bungkus', $itemsNumbered[0]['unit']);
        $this->assertEquals('Es Teh Manis', $itemsNumbered[1]['item']);
        $this->assertEquals(2, $itemsNumbered[1]['quantity']);
    }

    /**
     * 2. Test Checkout Pesanan Khusus menerapkan Ongkir 3.500 & Admin 2.500 serta auto-parsing checklist
     */
    public function test_checkout_custom_order_sets_custom_fees_and_parses_items(): void
    {
        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Tolong belikan buku sidu 3 buah dan pulpen standard 2 pcs',
            'delivery_location' => 'Kamar Al-Ghazali 05',
        ]);

        $response->assertStatus(201);
        $order = $response->json('order');

        $this->assertTrue((bool) $order['is_custom']);
        $this->assertEquals(0, (float) $order['total_price']);
        
        // Verifikasi Ongkir 3.500 & Admin 2.500
        $this->assertEquals(3500.0, (float) $order['delivery_fee']);
        $this->assertEquals(2500.0, (float) $order['admin_fee']);

        // Verifikasi auto-parsing checklist
        $dbOrder = Order::find($order['id']);
        $this->assertNotNull($dbOrder->custom_items);
        $this->assertIsArray($dbOrder->custom_items);
        $this->assertCount(2, $dbOrder->custom_items);
        $this->assertStringContainsString('Sidu', $dbOrder->custom_items[0]['item']);
        $this->assertEquals(3, $dbOrder->custom_items[0]['quantity']);
    }

    /**
     * 3. Test Toko Menetapkan Harga Pesanan Khusus menghitung total dengan Ongkir 3.500 & Admin 2.500
     */
    public function test_canteen_set_custom_order_price_uses_custom_fees(): void
    {
        // Buat pesanan khusus
        $order = Order::create([
            'checkout_id' => 'CHK-' . date('Ymd') . '-TEST01',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Beli vitamin C 2 strip',
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 0,
            'delivery_fee' => 3500,
            'admin_fee' => 2500,
            'delivery_location' => 'Kamar Al-Ghazali 05',
        ]);

        // Toko menentukan harga barang = Rp 15.000
        $response = $this->actingAs($this->kantinUser)->putJson("/api/canteen/orders/{$order->id}/custom-price", [
            'total_price' => 15000,
        ]);

        $response->assertStatus(200);

        // Total price = 15.000 (barang) + 3.500 (ongkir) + 2.500 (admin) = Rp 21.000
        $updatedOrder = Order::find($order->id);
        $this->assertEquals(21000.0, (float) $updatedOrder->total_price);
        $this->assertEquals(3500.0, (float) $updatedOrder->delivery_fee);
        $this->assertEquals(2500.0, (float) $updatedOrder->admin_fee);

        // Verifikasi metrik finansial
        $metrics = $updatedOrder->getFinancialMetrics();
        $this->assertEquals(15000.0, (float) $metrics['products_subtotal']);
        $this->assertEquals(3500.0, (float) $metrics['raw_delivery_fee']);
        $this->assertEquals(2500.0, (float) $metrics['raw_admin_fee']);
        $this->assertEquals(21000.0, (float) $metrics['total_price']);
    }

    /**
     * 4. Test Kurir / Pengguna dapat mencentang checklist belanja pesanan khusus
     */
    public function test_custom_items_checklist_can_be_updated(): void
    {
        $order = Order::create([
            'checkout_id' => 'CHK-' . date('Ymd') . '-TEST02',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Sabun Lifebuoy 1, Odol Pepsodent 1',
            'custom_items' => [
                ['id' => 1, 'item' => 'Sabun Lifebuoy', 'quantity' => 1, 'unit' => 'pcs', 'is_checked' => false],
                ['id' => 2, 'item' => 'Odol Pepsodent', 'quantity' => 1, 'unit' => 'pcs', 'is_checked' => false],
            ],
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 0,
            'delivery_fee' => 3500,
            'admin_fee' => 2500,
            'delivery_location' => 'Kamar Al-Ghazali 05',
        ]);

        // Centang item ke-1
        $updatedItems = [
            ['id' => 1, 'item' => 'Sabun Lifebuoy', 'quantity' => 1, 'unit' => 'pcs', 'is_checked' => true],
            ['id' => 2, 'item' => 'Odol Pepsodent', 'quantity' => 1, 'unit' => 'pcs', 'is_checked' => false],
        ];

        $response = $this->actingAs($this->kurirUser)->putJson("/api/orders/{$order->id}/custom-items", [
            'custom_items' => $updatedItems,
        ]);

        $response->assertStatus(200);

        $dbOrder = Order::find($order->id);
        $this->assertTrue((bool) $dbOrder->custom_items[0]['is_checked']);
        $this->assertFalse((bool) $dbOrder->custom_items[1]['is_checked']);
    }

    /**
     * 5. Test Endpoint re-parse catatan pesanan khusus
     */
    public function test_reparse_custom_notes_endpoint(): void
    {
        $order = Order::create([
            'checkout_id' => 'CHK-' . date('Ymd') . '-TEST03',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Minyak kayu putih 60ml 1 botol dan koyo cabe 2 pack',
            'custom_items' => null, // Belum diparsing
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 0,
            'delivery_fee' => 3500,
            'admin_fee' => 2500,
            'delivery_location' => 'Kamar Al-Ghazali 05',
        ]);

        $response = $this->actingAs($this->kurirUser)->postJson("/api/orders/{$order->id}/parse-custom");

        $response->assertStatus(200);
        $items = $response->json('custom_items');

        $this->assertIsArray($items);
        $this->assertCount(2, $items);
        $this->assertStringContainsString('Minyak Kayu Putih', $items[0]['item']);
        $this->assertEquals(1, $items[0]['quantity']);
        $this->assertEquals('botol', $items[0]['unit']);
        $this->assertEquals('Koyo Cabe', $items[1]['item']);
        $this->assertEquals(2, $items[1]['quantity']);
        $this->assertEquals('pack', $items[1]['unit']);
    }
}
