<?php

namespace App\Domains\Canteen\Jobs;

use App\Domains\Auth\User;
use App\Domains\Canteen\ActivityLog;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Services\ReceiptScannerService;
use App\Http\Controllers\Controller;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessPaymentProofAiJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Jumlah percobaan maksimal jika terjadi kegagalan
     */
    public int $tries = 2;

    /**
     * Waktu tunggu (detik) sebelum retry
     */
    public int $timeout = 60;

    /**
     * @param array $orderIds Daftar ID pesanan yang diverifikasi
     * @param array $uploadedPaths Path berkas bukti pembayaran di disk public
     * @param int|null $uploaderUserId ID pengguna yang mengunggah
     */
    public function __construct(
        public array $orderIds,
        public array $uploadedPaths,
        public ?int $uploaderUserId = null
    ) {}

    /**
     * Eksekusi verifikasi bukti bayar AI dan sinkronisasi ke Google Drive di latar belakang
     */
    public function handle(ReceiptScannerService $scanner): void
    {
        if (empty($this->orderIds) || empty($this->uploadedPaths)) {
            return;
        }

        $orders = Order::whereIn('id', $this->orderIds)->get();
        if ($orders->isEmpty()) {
            return;
        }

        try {
            Log::info("[ProcessPaymentProofAiJob] Memulai verifikasi AI di latar belakang untuk pesanan #" . implode(', #', $this->orderIds));

            // Jalankan verifikasi AI Gemini terhadap bukti pembayaran
            $aiResult = $scanner->verifyAndApplyPayment($orders, $this->uploadedPaths);

            // Jika AI berhasil memvalidasi dan pesanan lunas, otomatis sinkronkan ke Google Drive
            if (!empty($aiResult) && ($aiResult['verified'] ?? false)) {
                try {
                    $controller = app(Controller::class);
                    $firstOrder = $orders->first();
                    if ($firstOrder) {
                        $controller->syncProofToGoogleDrive($firstOrder, 'proof_of_payment');
                    }
                } catch (\Throwable $driveError) {
                    Log::warning("[ProcessPaymentProofAiJob] Gagal sinkronisasi Google Drive: " . $driveError->getMessage());
                }
            }

            // Catat log aktivitas sistem
            $uploaderUser = $this->uploaderUserId ? User::find($this->uploaderUserId) : null;
            $freshOrder   = $orders->first()->fresh()->load(['canteen', 'user']);
            $customerName = $freshOrder->user ? ($freshOrder->user->santri_name ?: $freshOrder->user->name) : "User #{$freshOrder->user_id}";
            $canteenNames = $orders->map(fn($o) => $o->canteen ? $o->canteen->name : "Kantin #{$o->canteen_id}")->unique()->implode(', ');
            $orderIdsStr  = $orders->pluck('id')->implode(', ');
            $totalFmt     = number_format($orders->sum('total_price'), 0, ',', '.');

            $scanData  = $aiResult['scan'] ?? [];
            $refNo     = $scanData['ref_number'] ?? ($scanData['proofs'][0]['ref_number'] ?? null);
            $bank      = $scanData['source_bank'] ?? ($scanData['proofs'][0]['source_bank'] ?? null);
            $transDate = $scanData['date'] ?? ($scanData['proofs'][0]['date'] ?? null);
            $transTime = $scanData['time'] ?? ($scanData['proofs'][0]['time'] ?? null);
            $refInfo   = $refNo ? " | Ref: {$refNo}" : '';
            $bankInfo  = $bank ? " | Bank: {$bank}" : '';
            $dateInfo  = $transDate ? " | Tgl Struk: {$transDate}" . ($transTime ? " {$transTime}" : '') : ' | Tgl Struk: Tidak tertera';
            $uploaderName = $uploaderUser ? $uploaderUser->name : 'System';

            if (!empty($aiResult)) {
                if ($aiResult['verified'] ?? false) {
                    ActivityLog::create([
                        'user_id'     => $this->uploaderUserId,
                        'action'      => 'ai_payment_verified',
                        'model_type'  => Order::class,
                        'model_id'    => $freshOrder->id,
                        'description' => "✅ AI Gemini MEMVERIFIKASI & MELUNASI pesanan #{$orderIdsStr} ({$canteenNames} - {$customerName}) senilai Rp {$totalFmt}{$bankInfo}{$refInfo}{$dateInfo}. Diunggah oleh: {$uploaderName}.",
                    ]);
                } else {
                    $failReason = $aiResult['message'] ?? 'Tidak diketahui';
                    ActivityLog::create([
                        'user_id'     => $this->uploaderUserId,
                        'action'      => 'ai_payment_unverified',
                        'model_type'  => Order::class,
                        'model_id'    => $freshOrder->id,
                        'description' => "⏳ AI Gemini GAGAL memverifikasi pesanan #{$orderIdsStr} ({$canteenNames} - {$customerName}) senilai Rp {$totalFmt}{$bankInfo}{$refInfo}{$dateInfo}. Alasan: {$failReason}. Menunggu konfirmasi manual admin. Diunggah oleh: {$uploaderName}.",
                    ]);
                }
            }

            Log::info("[ProcessPaymentProofAiJob] Selesai verifikasi AI untuk pesanan #" . implode(', #', $this->orderIds));
        } catch (\Throwable $e) {
            Log::error("[ProcessPaymentProofAiJob] Kesalahan saat verifikasi bukti transfer AI: " . $e->getMessage());
        }
    }
}
