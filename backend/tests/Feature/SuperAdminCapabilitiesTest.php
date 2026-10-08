<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use App\Domains\Delivery\Driver;
use App\Domains\Admin\PaymentLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class SuperAdminCapabilitiesTest extends TestCase
{
    use DatabaseTransactions;

    protected $superAdmin;
    protected $regularAdmin;
    protected $kantinUser;
    protected $canteen;
    protected $kurirUser;
    protected $santriUser;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Cache::flush();

        // 1. Super Admin
        $this->superAdmin = User::firstOrCreate(
            ['email' => 'superadmin_test@higopondok.com'],
            ['name' => 'Super Admin Test', 'password' => bcrypt('password'), 'role' => 'super_admin']
        );
        $this->superAdmin->syncRoles(['super_admin']);

        // 2. Regular Admin
        $this->regularAdmin = User::firstOrCreate(
            ['email' => 'admin_regular_test@higopondok.com'],
            ['name' => 'Regular Admin Test', 'password' => bcrypt('password'), 'role' => 'admin']
        );
        $this->regularAdmin->syncRoles(['admin']);

        // 3. Kantin
        $this->kantinUser = User::firstOrCreate(
            ['email' => 'kantin_super_test@higopondok.com'],
            ['name' => 'Kantin Super Test', 'password' => bcrypt('password'), 'role' => 'kantin']
        );
        $this->kantinUser->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinUser->id],
            [
                'name' => 'Kantin Super Admin Test',
                'delivery_fee' => 3000,
                'status' => 'approved',
                'balance' => 50000,
                'admin_debt' => 10000,
                'open_time' => '07:00:00',
                'close_time' => '21:00:00',
            ]
        );
        $this->canteen->update([
            'balance' => 50000,
            'admin_debt' => 10000,
            'status' => 'approved',
        ]);

        // 4. Kurir
        $this->kurirUser = User::firstOrCreate(
            ['email' => 'kurir_super_test@higopondok.com'],
            ['name' => 'Kurir Super Test', 'password' => bcrypt('password'), 'role' => 'kurir']
        );
        $this->kurirUser->syncRoles(['kurir']);

        // 5. Santri
        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_super_test@higopondok.com'],
            [
                'name' => 'Santri Super Test',
                'password' => bcrypt('password'),
                'role' => 'user',
                'phone' => '081234567899',
                'santri_name' => 'Ahmad Santri',
                'santri_room' => 'Kamar Usman 03',
                'santri_class' => '12 IPA',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->syncRoles(['user']);
    }

    /**
     * 1. Hak Akses Manajemen Pengguna (/admin/users):
     *    - Admin biasa DITOLAK (403 Forbidden)
     *    - User biasa DITOLAK (403 Forbidden)
     */
    public function test_regular_admin_and_user_forbidden_from_user_management(): void
    {
        $resAdmin = $this->actingAs($this->regularAdmin)->getJson('/api/admin/users');
        $resAdmin->assertStatus(403);

        $resSantri = $this->actingAs($this->santriUser)->getJson('/api/admin/users');
        $resSantri->assertStatus(403);
    }

    /**
     * 2. Super Admin Dapat Melihat, Menambah, Mengubah, dan Menghapus Pengguna (CRUD User)
     */
    public function test_super_admin_can_manage_users_crud(): void
    {
        // 1. List Users
        $listRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/users');
        $listRes->assertStatus(200);

        // 2. Create User baru dengan role kurir
        $createRes = $this->actingAs($this->superAdmin)->postJson('/api/admin/users', [
            'name' => 'Kurir Baru Super',
            'email' => 'kurir_baru_' . uniqid() . '@higopondok.com',
            'password' => 'password123',
            'role' => 'kurir',
            'status' => 'active',
            'canteen_ids' => [$this->canteen->id],
        ]);
        $createRes->assertStatus(201);
        $newUserId = $createRes->json('user.id');
        $this->assertNotNull($newUserId);

        $createdUser = User::find($newUserId);
        $this->assertTrue($createdUser->hasRole('kurir'));
        $this->assertTrue($createdUser->assignedCanteens->contains($this->canteen->id));

        // 3. Update User
        $updateRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/users/{$newUserId}", [
            'name' => 'Kurir Baru Super Diupdate',
            'email' => $createdUser->email,
            'role' => 'kurir',
            'phone' => '089911223344',
        ]);
        $updateRes->assertStatus(200);
        $this->assertEquals('Kurir Baru Super Diupdate', $createdUser->fresh()->name);

        // 4. Delete User
        $deleteRes = $this->actingAs($this->superAdmin)->deleteJson("/api/admin/users/{$newUserId}");
        $deleteRes->assertStatus(200);
        $this->assertNull(User::find($newUserId));
    }

    /**
     * 3. Super Admin Mengatur Status Guru / Staff Sekolah (/api/admin/users/{id}/set-teacher)
     */
    public function test_super_admin_can_set_and_revoke_teacher_status(): void
    {
        $targetUser = User::create([
            'name' => 'Calon Ustadz',
            'email' => 'calon_ustadz_' . uniqid() . '@higopondok.com',
            'password' => bcrypt('password'),
            'role' => 'user'
        ]);
        $targetUser->syncRoles(['user']);

        // Set Guru
        $setRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/users/{$targetUser->id}/set-teacher", [
            'is_teacher' => true,
            'niy' => 'NIY.2026.001',
            'teacher_unit' => 'SMP Plus',
        ]);
        $setRes->assertStatus(200);
        $this->assertTrue((bool) $targetUser->fresh()->is_teacher);
        $this->assertEquals('NIY.2026.001', $targetUser->fresh()->niy);

        // Revoke Guru
        $revokeRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/users/{$targetUser->id}/set-teacher", [
            'is_teacher' => false,
        ]);
        $revokeRes->assertStatus(200);
        $this->assertFalse((bool) $targetUser->fresh()->is_teacher);
    }

    /**
     * 4. Impersonate (Penyamaran Akun):
     *    - Super Admin & Admin bisa menyamar ke santri/kantin/kurir
     *    - Tidak bisa menyamar ke diri sendiri
     *    - Tidak bisa menyamar ke sesama Super Admin
     *    - Admin biasa tidak bisa menyamar ke sesama Admin
     */
    public function test_impersonate_user_capabilities_and_security_rules(): void
    {
        // 1. Super Admin menyamar menjadi Santri -> BERHASIL
        $impersonateRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/impersonate/{$this->santriUser->id}");
        $impersonateRes->assertStatus(200);
        $this->assertNotEmpty($impersonateRes->json('token'));
        $this->assertEquals($this->santriUser->id, $impersonateRes->json('user.id'));

        // 2. Super Admin mencoba menyamar ke diri sendiri -> DITOLAK (422)
        $selfRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/impersonate/{$this->superAdmin->id}");
        $selfRes->assertStatus(422);

        // 3. Regular Admin mencoba menyamar menjadi Super Admin -> DITOLAK (403)
        $adminToSuperRes = $this->actingAs($this->regularAdmin)->postJson("/api/admin/impersonate/{$this->superAdmin->id}");
        $adminToSuperRes->assertStatus(403);

        // 4. Regular Admin mencoba menyamar ke sesama Regular Admin -> DITOLAK (403)
        $fellowAdmin = User::create([
            'name' => 'Fellow Admin',
            'email' => 'fellow_admin_' . uniqid() . '@higopondok.com',
            'password' => bcrypt('password'),
            'role' => 'admin'
        ]);
        $fellowAdmin->syncRoles(['admin']);

        $adminToAdminRes = $this->actingAs($this->regularAdmin)->postJson("/api/admin/impersonate/{$fellowAdmin->id}");
        $adminToAdminRes->assertStatus(403);
    }

    /**
     * 5. Persetujuan & Penolakan Toko / Kantin (Approve & Reject)
     */
    public function test_admin_and_super_admin_can_approve_and_reject_canteens(): void
    {
        $pendingUser = User::create([
            'name' => 'Kantin Pending User',
            'email' => 'kantin_pending_' . uniqid() . '@higopondok.com',
            'password' => bcrypt('password'),
            'role' => 'kantin'
        ]);
        $pendingUser->syncRoles(['kantin']);

        $pendingCanteen = Canteen::create([
            'user_id' => $pendingUser->id,
            'name' => 'Kantin Baru Menunggu',
            'status' => 'pending',
            'open_time' => '08:00:00',
            'close_time' => '17:00:00',
        ]);

        // Cek daftar pending
        $listRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/canteens/pending');
        $listRes->assertStatus(200);
        $this->assertTrue(collect($listRes->json())->contains('id', $pendingCanteen->id));

        // Approve
        $approveRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/canteens/{$pendingCanteen->id}/approve");
        $approveRes->assertStatus(200);
        $this->assertEquals('approved', $pendingCanteen->fresh()->status);

        // Reject
        $rejectRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/canteens/{$pendingCanteen->id}/reject");
        $rejectRes->assertStatus(200);
        $this->assertEquals('rejected', $pendingCanteen->fresh()->status);
    }

    /**
     * 6. Kendali Darurat Toko: Bulk Close & Bulk Open Seluruh Pondok, Serta Tutup Paksa 1 Toko
     */
    public function test_emergency_canteen_controls_bulk_and_direct_toggle(): void
    {
        // 1. Bulk Close seluruh toko
        $closeRes = $this->actingAs($this->superAdmin)->postJson('/api/admin/canteens/bulk-close');
        $closeRes->assertStatus(200);
        $this->assertTrue(Cache::get('admin_global_canteen_force_closed'));
        $this->assertFalse($this->canteen->fresh()->is_open, 'Kantin harus tutup jika ada global force closed');

        // 2. Bulk Open kembali
        $openRes = $this->actingAs($this->superAdmin)->postJson('/api/admin/canteens/bulk-open');
        $openRes->assertStatus(200);
        $this->assertNull(Cache::get('admin_global_canteen_force_closed'));

        // 3. Tutup paksa spesifik 1 kantin (toggleDirectClose)
        $toggleCloseRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/canteens/{$this->canteen->id}/toggle-direct-close", [
            'force_close' => true
        ]);
        $toggleCloseRes->assertStatus(200);
        $this->assertFalse($this->canteen->fresh()->is_open);

        // Re-open kantin tersebut
        $toggleOpenRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/canteens/{$this->canteen->id}/toggle-direct-close", [
            'force_close' => false
        ]);
        $toggleOpenRes->assertStatus(200);
        $this->assertTrue($this->canteen->fresh()->is_open);
    }

    /**
     * 7. Operasi Finansial Admin: Pembayaran Tagihan Admin & Pencairan Saldo Kantin (Withdrawal)
     */
    public function test_admin_financial_operations_debt_pay_and_withdrawal(): void
    {
        // 1. Lunasi tagihan admin kantin
        $payDebtRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/canteens/{$this->canteen->id}/pay-debt");
        $payDebtRes->assertStatus(200);
        $this->assertEquals(0, (float) $this->canteen->fresh()->admin_debt);

        // 2. Pencairan saldo kantin oleh admin (Rp 20.000 dari Rp 50.000)
        $withdrawRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/canteens/{$this->canteen->id}/withdraw", [
            'amount' => 20000,
            'notes' => 'Pencairan via transfer bank BCA kantin'
        ]);
        $withdrawRes->assertStatus(200);

        $this->assertEquals(30000, (float) $this->canteen->fresh()->balance);

        // Verifikasi tercatat di PaymentLog
        $log = PaymentLog::where('user_id', $this->canteen->user_id)
            ->where('type', 'withdraw')
            ->where('amount', 20000)
            ->first();
        $this->assertNotNull($log);
    }

    /**
     * 8. Kelola Kotak Sampah Pesanan (Recycle Bin, Restore, Force Delete, Empty Trash)
     */
    public function test_admin_order_recycle_bin_and_permanent_delete_operations(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 10000,
            'delivery_location' => 'Kamar Usman 03',
        ]);

        // 1. Soft Delete pesanan ke Kotak Sampah
        $softDeleteRes = $this->actingAs($this->superAdmin)->deleteJson("/api/admin/orders/{$order->id}");
        $softDeleteRes->assertStatus(200);
        $this->assertSoftDeleted('orders', ['id' => $order->id]);

        // 2. Cek Kotak Sampah
        $trashRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/orders/trash');
        $trashRes->assertStatus(200);
        $this->assertTrue(collect($trashRes->json())->contains('id', $order->id));

        // 3. Restore pesanan
        $restoreRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/orders/{$order->id}/restore");
        $restoreRes->assertStatus(200);
        $this->assertNull($order->fresh()->deleted_at);

        // 4. Soft delete lagi lalu Force Delete permanen dari Kotak Sampah
        $this->actingAs($this->superAdmin)->deleteJson("/api/admin/orders/{$order->id}");
        $forceRes = $this->actingAs($this->superAdmin)->deleteJson("/api/admin/orders/{$order->id}/force");
        $forceRes->assertStatus(200);
        $this->assertDatabaseMissing('orders', ['id' => $order->id]);
    }

    /**
     * 9. Admin Membatalkan Pesanan Apa Pun (Bahkan yang Berstatus Processing / Completed)
     */
    public function test_admin_can_cancel_any_order(): void
    {
        $order = Order::create([
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'total_price' => 20000,
            'delivery_location' => 'Kamar Usman 03',
        ]);

        $cancelRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/orders/{$order->id}/cancel", [
            'reason' => 'Dibatalkan oleh Pengawas Pondok'
        ]);
        $cancelRes->assertStatus(200);

        $order->refresh();
        $this->assertEquals('cancelled', $order->status);
    }

    /**
     * 10. Dashboard Statistik Global Pondok, Rekapitulasi, dan Log Audit
     */
    public function test_admin_can_view_global_stats_recap_and_logs(): void
    {
        // 1. Stats
        $statsRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/stats');
        $statsRes->assertStatus(200);
        $this->assertArrayHasKey('total_santri', $statsRes->json());
        $this->assertArrayHasKey('payment_summary', $statsRes->json());

        // 2. Recap Global
        $recapRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/orders/recap?period=month');
        $recapRes->assertStatus(200);

        // 3. Activity Logs
        $activityRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/logs/activity');
        $activityRes->assertStatus(200);

        // 4. Payment Logs
        $paymentLogRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/logs/payment');
        $paymentLogRes->assertStatus(200);
    }
}
