<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\UserVoucher;
use App\Domains\Canteen\Canteen;
use Laravel\Sanctum\Sanctum;

class VoucherTargetingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_all_wali_vouchers_visible_to_all_users(): void
    {
        $charissa = User::where('name', 'like', '%Charissa%')->first();
        $asrul = User::where('email', 'info@staialmannan.ac.id')->first();
        $wali = User::where('email', 'wali@email.com')->first();

        $this->assertNotNull($charissa);
        $this->assertNotNull($asrul);
        $this->assertNotNull($wali);

        // Charissa request vouchers
        Sanctum::actingAs($charissa);
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
        $asrul = User::where('email', 'info@staialmannan.ac.id')->first();
        $wali = User::where('email', 'wali@email.com')->first();

        // 1. Asrul checks vouchers
        Sanctum::actingAs($asrul);
        $resAsrul = $this->getJson('/api/vouchers');
        $resAsrul->assertStatus(200);
        $codesAsrul = collect($resAsrul->json())->pluck('code')->toArray();

        // Asrul sees VIPASRUL and BEASISWAKANTIN
        $this->assertContains('VIPASRUL', $codesAsrul);
        $this->assertContains('BEASISWAKANTIN', $codesAsrul);
        // Asrul must NOT see WALIHEBAT (only for Charissa and Wali Zidan)
        $this->assertNotContains('WALIHEBAT', $codesAsrul);

        // 2. Wali Zidan checks vouchers
        Sanctum::actingAs($wali);
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
        $wali = User::where('email', 'wali@email.com')->first();
        $vAsrul = Voucher::where('code', 'VIPASRUL')->first();
        $this->assertNotNull($vAsrul);

        // Wali Zidan attempts to claim VIPASRUL
        Sanctum::actingAs($wali);
        $response = $this->postJson("/api/vouchers/{$vAsrul->id}/claim");

        // Must be rejected with 403 Forbidden
        $response->assertStatus(403);
        $response->assertJsonFragment([
            'message' => 'Voucher ini tidak ditujukan untuk akun santri Anda.'
        ]);
    }

    public function test_user_can_claim_eligible_voucher_successfully(): void
    {
        $charissa = User::where('name', 'like', '%Charissa%')->first();
        $vBeasiswa = Voucher::where('code', 'BEASISWAKANTIN')->first();
        $this->assertNotNull($vBeasiswa);

        // Ensure not previously claimed
        UserVoucher::where('user_id', $charissa->id)->where('voucher_id', $vBeasiswa->id)->delete();

        Sanctum::actingAs($charissa);
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
        $admin = User::role('admin')->first() ?: User::first();
        Sanctum::actingAs($admin);

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
        $admin = User::role('admin')->first() ?: User::first();
        $charissa = User::where('name', 'like', '%Charissa%')->first();
        Sanctum::actingAs($admin);

        $code = 'TESTSPECIFIC' . rand(100, 999);
        $response = $this->postJson('/api/admin/vouchers', [
            'code' => $code,
            'title' => 'Test Kupon Khusus Admin',
            'description' => 'Testing specific voucher creation',
            'discount_type' => 'product_discount',
            'discount_amount' => 5000,
            'min_purchase' => 10000,
            'valid_until' => now()->addDays(5)->toDateTimeString(),
            'target_type' => 'specific',
            'target_user_ids' => [$charissa->id],
            'quota' => 10,
        ]);

        $response->assertStatus(201);
        $voucherId = $response->json('voucher.id');

        $voucher = Voucher::find($voucherId);
        $this->assertNotNull($voucher);
        $this->assertEquals('specific', $voucher->target_type);
        $this->assertEquals([$charissa->id], $voucher->target_user_ids);

        // Cleanup
        $voucher->delete();
    }
}
