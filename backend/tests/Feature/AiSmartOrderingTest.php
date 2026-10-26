<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;

class AiSmartOrderingTest extends TestCase
{
    use DatabaseTransactions;

    protected $user;
    protected $canteen;
    protected $mieProduct;
    protected $udangProduct;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'user']);
        Role::firstOrCreate(['name' => 'kantin']);

        $this->user = User::firstOrCreate(
            ['email' => 'ahmad_santri_ai@higopondok.com'],
            [
                'name' => 'Ahmad Santri AI',
                'santri_name' => 'Ahmad Santri AI',
                'santri_room' => 'Al-Farabi 03',
                'phone' => '081234567890',
                'password' => bcrypt('password')
            ]
        );
        $this->user->syncRoles(['user']);

        $canteenUser = User::firstOrCreate(
            ['email' => 'gacoan_ai_owner@higopondok.com'],
            ['name' => 'Owner Gacoan AI', 'password' => bcrypt('password')]
        );
        $canteenUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['name' => 'Mie Gacoan AI Pondok'],
            [
                'user_id' => $canteenUser->id,
                'category' => 'kota',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'is_open' => true,
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
            ]
        );
        $this->canteen->update([
            'category' => 'kota',
            'delivery_fee' => 3000,
            'status' => 'approved',
            'is_open' => true,
            'open_time' => '00:00:00',
            'close_time' => '23:59:59',
        ]);

        $this->mieProduct = Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Mie Gacoan AI'],
            [
                'price' => 12000,
                'is_available' => true,
            ]
        );

        $this->udangProduct = Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Udang Keju AI'],
            [
                'price' => 10000,
                'is_available' => true,
            ]
        );
    }

    public function test_santri_bisa_chat_dan_mendapatkan_draf_pesanan_cerdas(): void
    {
        $prompt = "Halo, mau pesan Mie Gacoan AI level 1 dua porsi sama udang keju AI 1 porsi, antar ke kamar Al-Farabi 03 ya";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'reply_text',
                'is_order_ready',
                'is_custom',
                'delivery_location',
                'canteens',
                'summary' => [
                    'subtotal',
                    'delivery_fee',
                    'admin_fee',
                    'grand_total'
                ]
            ]);

        $data = $response->json();
        $this->assertTrue($data['is_order_ready']);
        $this->assertMatchesRegularExpression('/Al-Farabi 03/i', $data['delivery_location']);
        $this->assertEquals(3000, $data['summary']['delivery_fee']);
        $this->assertEquals(2000, $data['summary']['admin_fee']);
        
        $this->assertGreaterThanOrEqual(34000, $data['summary']['subtotal']);
        $this->assertGreaterThanOrEqual(39000, $data['summary']['grand_total']);
    }

    public function test_santri_bisa_konfirmasi_dan_pesanan_resmi_terbit_di_sistem(): void
    {
        $payload = [
            'delivery_location' => 'Kamar Al-Farabi 03',
            'is_custom' => false,
            'canteens' => [
                [
                    'canteen_id' => $this->canteen->id,
                    'canteen_name' => $this->canteen->name,
                    'items' => [
                        [
                            'product_id' => $this->mieProduct->id,
                            'name' => 'Mie Gacoan AI',
                            'variant' => 'Lv 1',
                            'quantity' => 2,
                            'price' => 12000
                        ],
                        [
                            'product_id' => $this->udangProduct->id,
                            'name' => 'Udang Keju AI',
                            'variant' => null,
                            'quantity' => 1,
                            'price' => 10000
                        ]
                    ]
                ]
            ],
            'summary' => [
                'subtotal' => 34000,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'grand_total' => 39000
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/confirm-order', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true
            ])
            ->assertJsonStructure([
                'checkout_id',
                'order_ids'
            ]);

        $this->assertDatabaseHas('orders', [
            'user_id' => $this->user->id,
            'canteen_id' => $this->canteen->id,
            'delivery_location' => 'Kamar Al-Farabi 03',
            'status' => 'pending',
            'delivery_fee' => 3000,
            'admin_fee' => 2000
        ]);
    }

    public function test_titip_beli_pesanan_khusus_dikenakan_ongkir_dan_admin_sesuai_aturan(): void
    {
        $prompt = "Tolong titip belikan Tolak Angin 2 sachet dan Paracetamol di Apotek Luar Pondok ke Kamar Ibnu Sina 01";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['is_custom']);
        $this->assertEquals(3500, $data['summary']['delivery_fee']);
        $this->assertEquals(2500, $data['summary']['admin_fee']);
    }

    public function test_ai_bisa_memproses_multi_varian_dan_memecah_item_berbeda_level(): void
    {
        // Pastikan produk memiliki config spicy enabled
        $this->mieProduct->update([
            'variant_config' => [
                'spicy' => [
                    'enabled' => true,
                    'options' => ['Lv 0', 'Lv 1', 'Lv 2', 'Lv 3']
                ]
            ]
        ]);

        $prompt = "Mau pesan Mie Gacoan AI 2 porsi, 1 level 1 dan 1 level 2 ke kamar Al-Farabi 03";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['is_order_ready']);
        $items = $data['canteens'][0]['items'] ?? [];
        $this->assertCount(2, $items, "Harus dipecah menjadi 2 baris item terpisah karena beda level");
        $this->assertEquals(1, $items[0]['quantity']);
        $this->assertEquals('[Lv 1]', $items[0]['notes']);
        $this->assertEquals(1, $items[1]['quantity']);
        $this->assertEquals('[Lv 2]', $items[1]['notes']);
    }

    public function test_santri_bisa_memesankan_untuk_santri_lain_tanpa_ubah_profil(): void
    {
        // Daftarkan santri tujuan di database santri
        $santriZaky = User::firstOrCreate(
            ['email' => 'zaky_santri_test@higopondok.com'],
            [
                'name' => 'Muhammad Zaky',
                'santri_name' => 'Muhammad Zaky',
                'santri_room' => 'Ibnu Rusyd 02',
                'phone' => '081234567899',
                'password' => bcrypt('password')
            ]
        );
        $santriZaky->syncRoles(['user']);

        $prompt = "Pesan buat santri Muhammad Zaky 2 Mie Gacoan AI level 1 antar ke kamar Ibnu Rusyd 02";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['is_order_ready']);
        $this->assertStringContainsString('Muhammad Zaky', $data['recipient_name']);
        $this->assertStringContainsString('Ibnu Rusyd 02', $data['delivery_location']);

        // Uji konfirmasi
        $confirmResponse = $this->actingAs($this->user)
            ->postJson('/api/ai/confirm-order', [
                'recipient_name' => $data['recipient_name'],
                'recipient_room' => $data['recipient_room'] ?? 'Kamar Ibnu Rusyd 02',
                'delivery_location' => $data['delivery_location'],
                'canteens' => $data['canteens'],
                'summary' => $data['summary'],
            ]);

        $confirmResponse->assertStatus(200);
        $this->assertDatabaseHas('orders', [
            'user_id' => $this->user->id,
            'recipient_santri_name' => 'Muhammad Zaky',
            'delivery_location' => 'Ibnu Rusyd 02',
        ]);
    }

    public function test_santri_search_dan_validasi_wajib_ada_di_data_santri(): void
    {
        // 1. Uji endpoint pencarian santri
        $searchRes = $this->actingAs($this->user)
            ->getJson('/api/ai/santri-search?query=Ahmad');

        $searchRes->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure(['data' => [['id', 'santri_name', 'santri_room']]]);

        // 2. Uji konfirmasi dengan santri yang tidak terdaftar di database harus ditolak
        $invalidConfirm = $this->actingAs($this->user)
            ->postJson('/api/ai/confirm-order', [
                'recipient_name' => 'Nama Santri Fiktif Tidak Terdaftar',
                'delivery_location' => 'Kamar Fiktif',
                'canteens' => [
                    [
                        'canteen_id' => $this->canteen->id,
                        'items' => [
                            [
                                'product_id' => $this->mieProduct->id,
                                'quantity' => 1,
                                'price' => 12000
                            ]
                        ]
                    ]
                ],
                'summary' => [
                    'subtotal' => 12000,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 17000
                ]
            ]);

        $invalidConfirm->assertStatus(422)
            ->assertJson([
                'error_code' => 'SANTRI_NOT_FOUND'
            ]);
    }

    public function test_user_bisa_eksplorasi_dan_menemukan_menu_bakso_di_kantin(): void
    {
        // Pastikan ada produk bakso di database
        Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Bakso Sapi Urat AI'],
            ['price' => 14000, 'is_available' => true]
        );
        Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Bakso Mercon AI'],
            ['price' => 15500, 'is_available' => true]
        );

        $prompt = "saya mau beli bakso";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        // AI harus mengenali menu Bakso dan TIDAK membalas tidak ada menu
        $this->assertFalse($data['is_order_ready']);
        $this->assertStringContainsString('Bakso', $data['reply_text']);
        $this->assertNotEmpty($data['quick_replies']);
        $this->assertTrue(collect($data['quick_replies'])->contains(fn($qr) => str_contains(strtolower($qr), 'bakso')));
    }

    public function test_user_bisa_langsung_memesan_varian_bakso_spesifik(): void
    {
        $baksoMercon = Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Bakso Mercon AI'],
            ['price' => 15500, 'is_available' => true]
        );

        $prompt = "Pesan 2 Bakso Mercon AI antar ke kamar Al-Farabi 03";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['is_order_ready']);
        $this->assertCount(1, $data['canteens']);
        $items = $data['canteens'][0]['items'];
        $this->assertEquals(2, $items[0]['quantity']);
        $this->assertEquals('Bakso Mercon AI', $items[0]['name']);
        $this->assertEquals(31000, $data['summary']['subtotal']);
    }

    public function test_santri_bisa_minta_chat_bantuan_ke_admin_dan_toko(): void
    {
        $prompt = "Saya butuh bantuan admin ada kendala pesanan";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertFalse($data['is_order_ready']);
        $this->assertTrue($data['is_help_intent']);
        $this->assertArrayHasKey('support_contact', $data);
        $this->assertNotEmpty($data['support_contact']['admin']['phone']);
        $this->assertStringContainsString('wa.me', $data['support_contact']['admin']['wa_url']);
        $this->assertNotEmpty($data['support_contact']['canteen']['wa_url']);
    }

    public function test_endpoint_support_contacts_mengembalikan_kontak_admin_dan_toko(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/ai/support-contacts');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'admin' => ['name', 'phone', 'wa_url'],
                    'canteen' => ['id', 'name', 'phone', 'wa_url'],
                    'all_canteens'
                ]
            ]);
    }

    public function test_santri_bisa_mengecek_status_pesanan_terkini_apakah_sudah_diterima(): void
    {
        // Buat pesanan untuk user
        $order = Order::create([
            'checkout_id' => 'CHK-TEST-001',
            'user_id' => $this->user->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'completed',
            'payment_status' => 'paid',
            'total_price' => 24000,
            'admin_fee' => 2000,
            'delivery_fee' => 3000,
            'delivery_location' => 'Kamar Al-Farabi 03',
            'recipient_santri_name' => 'Ahmad Santri AI',
            'recipient_santri_room' => 'Al-Farabi 03',
            'recipient_phone' => '081234567890',
        ]);

        $prompt = "bisa mengecek bagaimana pesanan saat ini bagaimana apakah sudah diterima santri";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertFalse($data['is_order_ready']);
        $this->assertTrue($data['is_check_order']);
        $this->assertArrayHasKey('order_status_info', $data);
        $this->assertEquals($order->id, $data['order_status_info']['order_id']);
        $this->assertTrue($data['order_status_info']['is_received']);
        $this->assertStringContainsString('SUDAH DITERIMA OLEH SANTRI', $data['reply_text']);
    }

    public function test_ai_bisa_mendeteksi_pesanan_dengan_typo_angka_menempel_dan_voice_slip(): void
    {
        Product::firstOrCreate(
            ['canteen_id' => $this->canteen->id, 'name' => 'Mie Ayam Kulit'],
            [
                'price' => 12000,
                'is_available' => true,
            ]
        );

        // Input pengetikan typo / voice-to-text seperti "4MIa Aya mKulis"
        $prompt = "4MIa Aya mKulis";

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/chat-order', [
                'message' => $prompt
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['is_order_ready']);
        $this->assertCount(1, $data['canteens']);
        $item = $data['canteens'][0]['items'][0];
        $this->assertStringContainsString('Mie Ayam Kulit', preg_replace('/\s+/', ' ', $item['name']));
        $this->assertEquals(4, $item['quantity']);
        $this->assertEquals(48000, $item['subtotal']);
    }
}

