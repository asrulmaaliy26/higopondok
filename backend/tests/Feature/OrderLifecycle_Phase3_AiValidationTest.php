<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Services\ReceiptScannerService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Mockery;

class OrderLifecycle_Phase3_AiValidationTest extends TestCase
{
    use DatabaseTransactions;

    protected $santriUser;
    protected $courierUser;
    protected $canteen;

    protected function setUp(): void
    {
        parent::setUp();

        $this->courierUser = User::firstOrCreate(
            ['email' => 'kurir_ai_test@higopondok.com'],
            ['name' => 'Kurir AI Test', 'password' => bcrypt('password')]
        );
        $this->courierUser->syncRoles(['kurir']);

        $this->santriUser = User::firstOrCreate(
            ['email' => 'santri_ai_test@higopondok.com'],
            [
                'name' => 'Wali AI Test',
                'password' => bcrypt('password'),
                'phone' => '081234567111',
                'santri_name' => 'Santri AI 1',
                'santri_room' => 'Kamar Abu Bakar 09',
                'santri_class' => '10 MIPA',
                'santri_level' => 'Aliyah',
            ]
        );
        $this->santriUser->syncRoles(['user']);

        $owner = User::firstOrCreate(
            ['email' => 'owner_ai_test@higopondok.com'],
            ['name' => 'Owner AI Test', 'password' => bcrypt('password')]
        );
        $owner->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $owner->id],
            [
                'name' => 'Kantin AI Validasi',
                'category' => 'canteen',
                'status' => 'approved',
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
                'delivery_fee' => 3000,
                'platform_fee' => 1000,
            ]
        );

        DB::table('canteen_couriers')->updateOrInsert(
            ['canteen_id' => $this->canteen->id, 'courier_id' => $this->courierUser->id],
            ['created_at' => now(), 'updated_at' => now()]
        );
    }

    public function test_valid_receipt_auto_advances_order_to_processing_and_assigns_courier()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-AI-VALID-01',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 50000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 09',
        ]);

        $mockScanner = Mockery::mock(ReceiptScannerService::class)->makePartial();
        $mockScanner->shouldReceive('scanReceipt')
            ->once()
            ->andReturn([
                'is_transfer_receipt' => true,
                'status' => 'SUCCESS',
                'amount' => 50000.0,
                'ref_number' => 'REF-SUCCESS-12345',
                'source_bank' => 'BCA',
                'date' => '2026-10-16',
                'time' => '19:30',
                'ai_note' => 'Struk transfer valid dan sesuai.',
            ]);

        $this->app->instance(ReceiptScannerService::class, $mockScanner);

        $result = $mockScanner->verifyAndApplyPayment(collect([$order]), ['dummy_proof.jpg']);

        $this->assertTrue($result['verified']);
        $order->refresh();

        // Verifikasi otomatis: Status menjadi processing, Lunas, dan kurir terisi
        $this->assertEquals('paid', $order->payment_status);
        $this->assertEquals('processing', $order->status);
        $this->assertEquals($this->courierUser->id, $order->courier_id);
    }

    public function test_shortage_receipt_does_not_advance_order_and_sets_waiting_confirmation()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-AI-SHORT-01',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 50000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 09',
        ]);

        $mockScanner = Mockery::mock(ReceiptScannerService::class)->makePartial();
        $mockScanner->shouldReceive('scanReceipt')
            ->once()
            ->andReturn([
                'is_transfer_receipt' => true,
                'status' => 'SUCCESS',
                'amount' => 30000.0, // Kurang 20.000
                'ref_number' => 'REF-SHORT-9999',
                'source_bank' => 'BSI',
                'date' => '2026-10-16',
                'time' => '19:35',
                'ai_note' => 'Nominal kurang Rp 20.000.',
            ]);

        $this->app->instance(ReceiptScannerService::class, $mockScanner);

        $result = $mockScanner->verifyAndApplyPayment(collect([$order]), ['dummy_proof.jpg']);

        $this->assertFalse($result['verified']);
        $order->refresh();

        // Karena kurang bayar, pembayaran berstatus waiting_confirmation dan status TETAP pending (belum diantar)
        $this->assertEquals('waiting_confirmation', $order->payment_status);
        $this->assertEquals('pending', $order->status);
    }

    public function test_duplicate_reference_number_is_flagged_as_fraud()
    {
        // 1. Pesanan terdahulu yang sudah lunas dengan nomor ref ini
        Order::create([
            'checkout_id' => 'CHK-OLD-PAID',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'completed',
            'payment_status' => 'paid',
            'payment_ref_number' => 'REF-DUPLICATE-77777',
            'total_price' => 50000,
        ]);

        // 2. Pesanan baru yang mencoba menggunakan nomor ref yang sama
        $newOrder = Order::create([
            'checkout_id' => 'CHK-NEW-ATTEMPT',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 50000,
        ]);

        $mockScanner = Mockery::mock(ReceiptScannerService::class)->makePartial();
        $mockScanner->shouldReceive('scanReceipt')
            ->once()
            ->andReturn([
                'is_transfer_receipt' => true,
                'status' => 'SUCCESS',
                'amount' => 50000.0,
                'ref_number' => 'REF-DUPLICATE-77777',
                'source_bank' => 'BRI',
                'date' => '2026-10-16',
                'time' => '19:40',
            ]);

        $this->app->instance(ReceiptScannerService::class, $mockScanner);

        $result = $mockScanner->verifyAndApplyPayment(collect([$newOrder]), ['dummy_proof.jpg']);

        $this->assertFalse($result['verified']);
        $this->assertStringContainsString('sudah pernah digunakan', $result['message']);
        $newOrder->refresh();

        // Tidak boleh otomatis lunas jika nomor referensi duplikat
        $this->assertNotEquals('paid', $newOrder->payment_status);
        $this->assertEquals('waiting_confirmation', $newOrder->payment_status);
    }

    public function test_option1_local_temp_path_is_used_for_scanning_when_drive_url_is_stored()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-AI-DRIVE-01',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 50000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 09',
        ]);

        $tempFile = tempnam(sys_get_temp_dir(), 'proof_test_');
        file_put_contents($tempFile, 'dummy-image-binary-data');

        $driveUrl = 'https://drive.google.com/uc?id=mockDriveId999';

        $mockScanner = Mockery::mock(ReceiptScannerService::class)->makePartial();
        $mockScanner->shouldReceive('scanReceipt')
            ->once()
            ->with($tempFile) // Memastikan AI menerima path lokal sementara, bukan Drive URL
            ->andReturn([
                'is_transfer_receipt' => true,
                'status' => 'SUCCESS',
                'amount' => 50000.0,
                'ref_number' => 'REF-DRIVE-OPTI-1',
                'source_bank' => 'BCA',
                'date' => '2026-10-16',
                'time' => '20:00',
                'ai_note' => 'Struk via local temp berhasil dibaca.',
            ]);

        $this->app->instance(ReceiptScannerService::class, $mockScanner);

        $result = $mockScanner->verifyAndApplyPayment(collect([$order]), [$driveUrl], [$tempFile]);

        @unlink($tempFile);

        $this->assertTrue($result['verified']);
        // Pastikan path yang tercatat ke DB tetap Drive URL
        $this->assertEquals($driveUrl, $result['scan']['file_path']);

        $order->refresh();
        $this->assertEquals('paid', $order->payment_status);
        $this->assertEquals('processing', $order->status);
    }

    public function test_ai_checks_first_and_automatically_uploads_to_drive_when_status_becomes_paid()
    {
        $order = Order::create([
            'checkout_id' => 'CHK-AI-SYNC-DRIVE-TEST',
            'user_id' => $this->santriUser->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'total_price' => 50000,
            'delivery_fee' => 3000,
            'admin_fee' => 1000,
            'delivery_location' => 'Kamar Abu Bakar 09',
        ]);

        $localPath = 'proofs/test_struk.jpg';
        $order->proof_of_payment = [$localPath];
        $order->save();

        $mockPublicDisk = Mockery::mock();
        $mockPublicDisk->shouldReceive('exists')->with('proofs/test_struk.jpg')->andReturn(true);
        $mockPublicDisk->shouldReceive('get')->with('proofs/test_struk.jpg')->andReturn('dummy-binary-content');
        $mockPublicDisk->shouldReceive('delete')->with('proofs/test_struk.jpg')->andReturn(true);

        $mockGoogleDisk = Mockery::mock();
        $mockGoogleDisk->shouldReceive('put')->with('proofs/test_struk.jpg', 'dummy-binary-content')->once()->andReturn(true);
        $mockGoogleDisk->shouldReceive('url')->with('proofs/test_struk.jpg')->once()->andReturn('https://drive.google.com/uc?id=mockGoogleDriveId12345&export=media');

        \Illuminate\Support\Facades\Storage::shouldReceive('disk')->with('public')->andReturn($mockPublicDisk);
        \Illuminate\Support\Facades\Storage::shouldReceive('disk')->with('google')->andReturn($mockGoogleDisk);

        // Controller menjalankan syncProofToGoogleDrive saat status LUNAS
        $controller = new class extends \App\Http\Controllers\Controller {
            public function sync($ord) {
                return $this->syncProofToGoogleDrive($ord, 'proof_of_payment');
            }
        };

        $synced = $controller->sync($order);

        $this->assertEquals(['https://drive.google.com/uc?id=mockGoogleDriveId12345&export=media'], $synced);
        $order->refresh();
        $this->assertEquals(['https://drive.google.com/uc?id=mockGoogleDriveId12345&export=media'], $order->proof_of_payment);
    }

}

