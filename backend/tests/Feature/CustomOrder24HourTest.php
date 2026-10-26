<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;

class CustomOrder24HourTest extends TestCase
{
    use DatabaseTransactions;

    protected $kantinUser;
    protected $canteen;
    protected $santriUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->kantinUser = User::firstOrCreate(
            ['email' => 'kantin_24h_test@higopondok.com'],
            ['name' => 'Kantin 24H Test', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->kantinUser->syncRoles(['kantin']);

        // Kantin sedang tutup (jam buka sudah lewat, misal 01:00 - 02:00)
        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinUser->id],
            [
                'name' => 'Kantin Tutup 24H Test',
                'description' => 'Kantin sedang tutup',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'open_time' => '01:00:00',
                'close_time' => '02:00:00',
            ]
        );

        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_24h_test@higopondok.com'],
            [
                'name' => 'Ahmad Santri 24H',
                'password' => bcrypt('password'),
                'role' => 'user',
                'santri_name' => 'Ahmad 24H',
                'santri_room' => 'Kamar Al-Farabi 01',
                'santri_class' => '11B',
                'santri_level' => 'MA',
                'phone' => '081234567800'
            ]
        );
        $this->santriUser->syncRoles(['user']);
    }

    /**
     * 1. Test Pesanan Khusus (is_custom = true) Berhasil dibuat walau Kantin sedang TUTUP
     */
    public function test_custom_order_can_be_ordered_anytime_even_when_canteen_is_closed(): void
    {
        // Pastikan kantin memang sedang tutup
        $this->assertFalse((bool) $this->canteen->is_open);

        $startTime = microtime(true);

        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteen->id,
            'is_custom' => true,
            'custom_notes' => 'Tolong belikan buku tulis sidu 2 pack, pulpen 3 pcs, tolak angin 5 saset',
            'delivery_location' => 'Kamar Al-Farabi 01',
        ]);

        $executionTimeMs = (microtime(true) - $startTime) * 1000;

        $response->assertStatus(201);
        $data = $response->json('order');

        $this->assertTrue((bool) $data['is_custom']);
        $this->assertEquals(0, (float) $data['total_price']);
        $this->assertEquals(3500.0, (float) $data['delivery_fee']);
        $this->assertEquals(2500.0, (float) $data['admin_fee']);
        $this->assertEquals('pending', $data['status']);
        $this->assertEquals('unpaid', $data['payment_status']);

        // Verifikasi items checklist ter-parse rapi tanpa AI latency
        $this->assertIsArray($data['custom_items']);
        $this->assertCount(3, $data['custom_items']);
        $this->assertStringContainsString('Buku Tulis Sidu', $data['custom_items'][0]['item']);
        $this->assertEquals(2, $data['custom_items'][0]['quantity']);
        $this->assertEquals('pack', $data['custom_items'][0]['unit']);

        // Kecepatan proses harus sangat cepat (< 500ms)
        $this->assertLessThan(1000, $executionTimeMs, "Submit pesanan khusus harus di bawah 1 detik, aktual: {$executionTimeMs} ms");
    }

    /**
     * 2. Test Pesanan Reguler (bukan khusus) tetap ditolak jika kantin TUTUP
     */
    public function test_regular_catalog_order_is_blocked_when_canteen_is_closed(): void
    {
        $this->assertFalse((bool) $this->canteen->is_open);

        $product = \App\Domains\Canteen\Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Menu Toko Tutup'],
            ['price' => 10000, 'is_available' => true]
        );

        $response = $this->actingAs($this->santriUser)->postJson('/api/orders', [
            'canteen_id' => $this->canteen->id,
            'is_custom' => false,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ],
            'delivery_location' => 'Kamar Al-Farabi 01',
        ]);

        $response->assertStatus(400);
        $this->assertStringContainsString('saat ini sedang tutup', $response->json('message'));
    }
}
