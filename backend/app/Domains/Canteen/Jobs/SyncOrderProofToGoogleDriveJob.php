<?php

namespace App\Domains\Canteen\Jobs;

use App\Domains\Canteen\Order;
use App\Http\Controllers\Controller;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncOrderProofToGoogleDriveJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    /**
     * @param int $orderId
     * @param string $proofField ('proof_of_delivery', 'proof_of_purchase', 'proof_of_payment')
     */
    public function __construct(
        public int $orderId,
        public string $proofField = 'proof_of_delivery'
    ) {}

    /**
     * Pindahkan file bukti dari disk lokal (public) ke Google Drive di latar belakang,
     * lalu hapus file fisik lokal agar kapasitas server tetap hemat dan tidak memberatkan server.
     */
    public function handle(): void
    {
        try {
            $order = Order::find($this->orderId);
            if (!$order) {
                return;
            }

            $controller = app(Controller::class);
            $controller->syncProofToGoogleDrive($order, $this->proofField);

            Log::info("[SyncOrderProofToGoogleDriveJob] Sukses sinkronisasi {$this->proofField} untuk pesanan #{$this->orderId} ke Google Drive & file lokal telah dibersihkan.");
        } catch (\Throwable $e) {
            Log::warning("[SyncOrderProofToGoogleDriveJob] Gagal sinkronisasi Google Drive untuk pesanan #{$this->orderId} ({$this->proofField}): " . $e->getMessage());
        }
    }
}
