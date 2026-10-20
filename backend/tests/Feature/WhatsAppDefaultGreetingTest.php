<?php

namespace Tests\Feature;

use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Services\AiSmartOrderingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class WhatsAppDefaultGreetingTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $waliUser;
    protected User $teacherUser;
    protected Canteen $canteen;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'super_admin']);
        Role::firstOrCreate(['name' => 'admin']);
        Role::firstOrCreate(['name' => 'user']);
        Role::firstOrCreate(['name' => 'kantin']);
        Role::firstOrCreate(['name' => 'kurir']);

        // Admin Pusat
        $this->adminUser = User::create([
            'name' => 'Admin HiGO Pondok',
            'email' => 'admin@higopondok.id',
            'phone' => '081234567890',
            'password' => bcrypt('password123'),
        ]);
        $this->adminUser->assignRole('admin');

        // Pengelola Kantin
        $canteenOwner = User::create([
            'name' => 'Pemilik Toko Berkah',
            'email' => 'berkah@higopondok.id',
            'phone' => '082233445566',
            'password' => bcrypt('password123'),
        ]);
        $canteenOwner->assignRole('kantin');

        $this->canteen = Canteen::create([
            'user_id' => $canteenOwner->id,
            'name' => 'Toko Berkah Al-Mannan',
            'category' => 'Makanan',
            'whatsapp_number' => '082233445566',
            'is_approved' => true,
            'is_open' => true,
        ]);

        // User Wali Santri
        $this->waliUser = User::create([
            'name' => 'Bapak Suhartono',
            'email' => 'suhartono@example.com',
            'phone' => '081399887766',
            'santri_name' => 'Ahmad Al-Farizi',
            'santri_room' => 'Abu Bakar 02',
            'santri_class' => '10 IPA',
            'password' => bcrypt('password123'),
        ]);
        $this->waliUser->assignRole('user');

        // User Guru / Staff
        $this->teacherUser = User::create([
            'name' => 'Ustadz Abdullah S.Pd',
            'email' => 'abdullah@example.com',
            'phone' => '081987654321',
            'is_teacher' => true,
            'teacher_unit' => 'Unit Madrasah Aliyah',
            'password' => bcrypt('password123'),
        ]);
        $this->teacherUser->assignRole('user');
    }

    public function test_wali_chat_admin_dan_toko_selalu_memuat_default_salam_nama_wali_dan_nama_santri(): void
    {
        $response = $this->actingAs($this->waliUser)
            ->getJson("/api/ai/support-contacts?canteen_id={$this->canteen->id}");

        $response->assertStatus(200);
        $data = $response->json('data');

        $adminWaUrl = urldecode($data['admin']['wa_url']);
        $canteenWaUrl = urldecode($data['canteen']['wa_url']);

        // Verifikasi link Admin mengandung Salam, Nama Wali, Nama Santri, dan Kamar/Kelas
        $this->assertStringContainsString("Assalamu'alaikum Warahmatullahi Wabarakatuh", $adminWaUrl);
        $this->assertStringContainsString("Admin HiGO Pondok", $adminWaUrl);
        $this->assertStringContainsString("*Nama Wali*: Bapak Suhartono", $adminWaUrl);
        $this->assertStringContainsString("*Nama Santri*: Ahmad Al-Farizi", $adminWaUrl);
        $this->assertStringContainsString("Abu Bakar 02", $adminWaUrl);

        // Verifikasi link Toko mengandung Salam, Nama Toko, Nama Wali, dan Nama Santri
        $this->assertStringContainsString("Assalamu'alaikum Warahmatullahi Wabarakatuh", $canteenWaUrl);
        $this->assertStringContainsString("Toko Berkah Al-Mannan", $canteenWaUrl);
        $this->assertStringContainsString("*Nama Wali*: Bapak Suhartono", $canteenWaUrl);
        $this->assertStringContainsString("*Nama Santri*: Ahmad Al-Farizi", $canteenWaUrl);
        $this->assertStringContainsString("Abu Bakar 02", $canteenWaUrl);
    }

    public function test_guru_chat_admin_dan_toko_selalu_memuat_identitas_guru(): void
    {
        $response = $this->actingAs($this->teacherUser)
            ->getJson("/api/ai/support-contacts?canteen_id={$this->canteen->id}");

        $response->assertStatus(200);
        $data = $response->json('data');

        $adminWaUrl = urldecode($data['admin']['wa_url']);
        $canteenWaUrl = urldecode($data['canteen']['wa_url']);

        // Verifikasi format akun Guru / Staff
        $this->assertStringContainsString("*Guru / Staff*: Ustadz Abdullah S.Pd", $adminWaUrl);
        $this->assertStringContainsString("Unit Madrasah Aliyah", $adminWaUrl);

        $this->assertStringContainsString("*Guru / Staff*: Ustadz Abdullah S.Pd", $canteenWaUrl);
        $this->assertStringContainsString("Toko Berkah Al-Mannan", $canteenWaUrl);
    }

    public function test_service_helper_menghasilkan_teks_salam_yang_lengkap(): void
    {
        $text = AiSmartOrderingService::buildUserGreetingText(
            $this->waliUser,
            "Toko Berkah",
            "saya ingin konfirmasi ketersediaan sarapan pagi."
        );

        $this->assertStringContainsString("Assalamu'alaikum Warahmatullahi Wabarakatuh, Toko Berkah", $text);
        $this->assertStringContainsString("Nama Wali*: Bapak Suhartono", $text);
        $this->assertStringContainsString("Nama Santri*: Ahmad Al-Farizi", $text);
        $this->assertStringContainsString("Kamar / Kelas*: 10 IPA | Abu Bakar 02", $text);
        $this->assertStringContainsString("saya ingin konfirmasi ketersediaan sarapan pagi.", $text);
        $this->assertStringContainsString("Syukron Jazakumullah Khairan", $text);
    }
}
