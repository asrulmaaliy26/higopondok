<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\UserVoucher;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class VoucherTargetingTest extends TestCase
{
    use DatabaseTransactions;

    protected User $charissa;
    protected User $asrul;
    protected User $wali;
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        // --- Setup Users ---
        $this->admin = User::firstOrCreate(
            ['email' => 'admin_voucher_test@higopondok.test'],
            ['name' => 'Admin Voucher Test', 'password' => bcrypt('password'), 'role' => 'admin']
        );
        $this->admin->syncRoles(['admin']);

        $this->charissa = User::firstOrCreate(
            ['email' => 'charissa_voucher_test@higopondok.test'],
            [
                'name' => 'Charissa Voucher Test',
                'password' => bcrypt('password'),
                'role' => 'user',
                'santri_name' => 'Charissa',
                'santri_room' => 'Kamar Wali 01',
            ]
        );
        $this->charissa->syncRoles(['user']);

        $this->asrul = User::firstOrCreate(
            ['email' => 'asrul_voucher_test@higopondok.test'],
            [
                'name' => 'Asrul Voucher Test',
                'password' => bcrypt('password'),
                'role' => 'user',
                'santri_name' => 'Asrul',
                'santri_room' => 'Kamar Wali 02',
            ]
        );
        $this->asrul->syncRoles(['user']);

        $this->wali = User::firstOrCreate(
            ['email' => 'wali_zidan_voucher_test@higopondok.test'],
            [
                'name' => 'Wali Zidan Test',
                'password' => bcrypt('password'),
                'role' => 'user',
                'santri_name' => 'Zidan',
                'santri_room' => 'Kamar Wali 03',
            ]
        );
        $this->wali->syncRoles(['user']);

        // --- Hapus voucher test sebelumnya jika ada ---
        $codes = ['ONGKIRHEMAT', 'SANTRIBERKAH', 'BEBASADMIN', 'WALIHEBAT', 'BEASISWAKANTIN', 'VIPASRUL'];
        Voucher::whereIn('code', $codes)->forceDelete();

        // --- Setup Vouchers ---
        // 'all' target vouchers (visible to everyone)
        foreach (['ONGKIRHEMAT', 'SANTRIBERKAH', 'BEBASADMIN'] as $code) {
            Voucher::create([
                'code'                => $code,
                'title'               => "Voucher {$code}",
                'description'         => "Test voucher {$code}",
                'discount_type'       => 'delivery_fee',
                'discount_amount'     => 1000,
                'min_purchase'        => 0,
                'target_type'         => 'all',
                'target_user_ids'     => null,
                'quota'               => 100,
                'claimed_count'       => 0,
                'valid_until'         => now()->addMonth(),
                'is_active'           => true,
                'created_by_user_id'  => $this->admin->id,
            ]);
        }

        // Voucher WALIHEBAT: specific to Charissa & Wali Zidan
        Voucher::create([
            'code'                => 'WALIHEBAT',
            'title'               => 'Voucher Wali Hebat',
            'description'         => 'Test spesifik Charissa + Wali',
            'discount_type'       => 'delivery_fee',
            'discount_amount'     => 2000,
            'min_purchase'        => 0,
            'target_type'         => 'specific',
            'target_user_ids'     => [$this->charissa->id, $this->wali->id],
            'quota'               => 50,
            'claimed_count'       => 0,
            'valid_until'         => now()->addMonth(),
            'is_active'           => true,
            'created_by_user_id'  => $this->admin->id,
        ]);

        // Voucher BEASISWAKANTIN: specific to Charissa & Asrul
        Voucher::create([
            'code'                => 'BEASISWAKANTIN',
            'title'               => 'Beasiswa Kantin',
            'description'         => 'Test spesifik Charissa + Asrul',
            'discount_type'       => 'admin_fee',
            'discount_amount'     => 3000,
            'min_purchase'        => 0,
            'target_type'         => 'specific',
            'target_user_ids'     => [$this->charissa->id, $this->asrul->id],
            'quota'               => 50,
            'claimed_count'       => 0,
            'valid_until'         => now()->addMonth(),
            'is_active'           => true,
            'created_by_user_id'  => $this->admin->id,
        ]);

        // Voucher VIPASRUL: specific only to Asrul
        Voucher::create([
            'code'                => 'VIPASRUL',
            'title'               => 'VIP Asrul',
            'description'         => 'Hanya untuk Asrul',
            'discount_type'       => 'product_discount',
            'discount_amount'     => 5000,
            'min_purchase'        => 0,
            'target_type'         => 'specific',
            'target_user_ids'     => [$this->asrul->id],
            'quota'               => 10,
            'claimed_count'       => 0,
            'valid_until'         => now()->addMonth(),
            'is_active'           => true,
            'created_by_user_id'  => $this->admin->id,
        ]);
    }

    public function test_all_wali_vouchers_visible_to_all_users(): void
    {
        // Charissa request vouchers
        Sanctum::actingAs($this->charissa);
        $resCharissa = $this->getJson('/api/vouchers');
        $resCharissa->assertStatus(200);
        $codesCharissa = collect($resCharissa->json())->pluck('code')->toArray();

        // Must see 'all' vouchers
        $this->assertContains('ONGKIRHEMAT', $codesCharissa);
        $this->assertContains('SANTRIBERKAH', $codesCharissa);
        $this->assertContains('BEBASADMIN', $codesCharissa);

        // Must see specific voucher targeted to Charissa
        $this->assertContains('WALIHEBAT', $codesCharissa);
        $this->assertContains('BEASISWAKANTIN', $codesCharissa);

        // Must NOT see VIPASRUL (only targeted to Asrul)
        $this->assertNotContains('VIPASRUL', $codesCharissa);
    }

    public function test_specific_voucher_isolation_between_wali(): void
    {
        // 1. Asrul checks vouchers
        Sanctum::actingAs($this->asrul);
        $resAsrul = $this->getJson('/api/vouchers');
        $resAsrul->assertStatus(200);
        $codesAsrul = collect($resAsrul->json())->pluck('code')->toArray();

        // Asrul sees VIPASRUL and BEASISWAKANTIN
        $this->assertContains('VIPASRUL', $codesAsrul);
        $this->assertContains('BEASISWAKANTIN', $codesAsrul);
        // Asrul must NOT see WALIHEBAT (only for Charissa and Wali Zidan)
        $this->assertNotContains('WALIHEBAT', $codesAsrul);

        // 2. Wali Zidan checks vouchers
        Sanctum::actingAs($this->wali);
        $resWali = $this->getJson('/api/vouchers');
        $resWali->assertStatus(200);
        $codesWali = collect($resWali->json())->pluck('code')->toArray();

        // Wali Zidan sees WALIHEBAT
        $this->assertContains('WALIHEBAT', $codesWali);
        // Wali Zidan must NOT see VIPASRUL or BEASISWAKANTIN
        $this->assertNotContains('VIPASRUL', $codesWali);
        $this->assertNotContains('BEASISWAKANTIN', $codesWali);
    }

    public function test_user_cannot_claim_voucher_targeted_to_someone_else(): void
    {
        $vAsrul = Voucher::where('code', 'VIPASRUL')->first();
        $this->assertNotNull($vAsrul);

        // Wali Zidan attempts to claim VIPASRUL
        Sanctum::actingAs($this->wali);
        $response = $this->postJson("/api/vouchers/{$vAsrul->id}/claim");

        // Must be rejected with 403 Forbidden
        $response->assertStatus(403);
        $response->assertJsonFragment([
            'message' => 'Voucher ini tidak ditujukan untuk akun santri Anda.'
        ]);
    }

    public function test_user_can_claim_eligible_voucher_successfully(): void
    {
        $vBeasiswa = Voucher::where('code', 'BEASISWAKANTIN')->first();
        $this->assertNotNull($vBeasiswa);

        // Ensure not previously claimed
        UserVoucher::where('user_id', $this->charissa->id)->where('voucher_id', $vBeasiswa->id)->delete();

        Sanctum::actingAs($this->charissa);
        $response = $this->postJson("/api/vouchers/{$vBeasiswa->id}/claim");
        $response->assertStatus(201);
        $response->assertJsonFragment([
            'message' => 'Voucher berhasil diklaim! Gunakan saat membuat pesanan.'
        ]);

        // Attempting to claim again must fail with 422
        $resDuplicate = $this->postJson("/api/vouchers/{$vBeasiswa->id}/claim");
        $resDuplicate->assertStatus(422);
    }

    public function test_santri_options_endpoint_returns_wali_and_santri_options(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/admin/vouchers/santri-options');
        $response->assertStatus(200);
        $data = $response->json();

        $this->assertIsArray($data);
        $this->assertNotEmpty($data);

        // Check required fields
        $first = $data[0];
        $this->assertArrayHasKey('id', $first);
        $this->assertArrayHasKey('santri_name', $first);
        $this->assertArrayHasKey('santri_room', $first);
    }

    public function test_admin_can_create_new_specific_voucher(): void
    {
        Sanctum::actingAs($this->admin);

        $code = 'TESTSPECIFIC' . rand(100, 999);
        $response = $this->postJson('/api/admin/vouchers', [
            'code'            => $code,
            'title'           => 'Test Kupon Khusus Admin',
            'description'     => 'Testing specific voucher creation',
            'discount_type'   => 'product_discount',
            'discount_amount' => 5000,
            'min_purchase'    => 10000,
            'valid_until'     => now()->addDays(5)->toDateTimeString(),
            'target_type'     => 'specific',
            'target_user_ids' => [$this->charissa->id],
            'quota'           => 10,
        ]);

        $response->assertStatus(201);
        $voucherId = $response->json('voucher.id');

        $voucher = Voucher::find($voucherId);
        $this->assertNotNull($voucher);
        $this->assertEquals('specific', $voucher->target_type);
        $this->assertEquals([$this->charissa->id], $voucher->target_user_ids);

        // Cleanup
        $voucher->delete();
    }
}
