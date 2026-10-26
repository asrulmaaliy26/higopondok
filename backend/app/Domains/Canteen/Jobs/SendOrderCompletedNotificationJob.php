<?php

namespace App\Domains\Canteen\Jobs;

use App\Domains\Canteen\Mail\CanteenOrderCompletedMail;
use App\Domains\Canteen\Mail\CustomerOrderCompletedMail;
use App\Domains\Canteen\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendOrderCompletedNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;

    public function __construct(public int $orderId)
    {
    }

    public function handle(): void
    {
        try {
            $order = Order::with(['user', 'canteen.user', 'courier', 'items.product'])->find($this->orderId);

            if (!$order) {
                Log::warning("[SendOrderCompletedNotificationJob] Order #{$this->orderId} tidak ditemukan.");
                return;
            }

            // Pastikan pesanan berstatus completed
            if ($order->status !== 'completed') {
                Log::info("[SendOrderCompletedNotificationJob] Order #{$this->orderId} status bukan completed ({$order->status}). Batal kirim email.");
                return;
            }

            // 1. Notifikasi ke Pembeli (Santri / Wali Santri)
            $customer = $order->user;
            if ($customer && !empty($customer->email) && filter_var($customer->email, FILTER_VALIDATE_EMAIL)) {
                try {
                    Mail::to($customer->email)->send(new CustomerOrderCompletedMail($order));
                    Log::info("[SendOrderCompletedNotificationJob] Email pesanan selesai sukses dikirim ke Pembeli ({$customer->email}) untuk pesanan #{$order->id}");
                } catch (\Throwable $e) {
                    Log::error("[SendOrderCompletedNotificationJob] Gagal mengirim email ke Pembeli ({$customer->email}) untuk pesanan #{$order->id}: " . $e->getMessage());
                }
            }

            // 2. Notifikasi ke Mitra Kantin
            $canteenUser = $order->canteen?->user;
            $customerEmail = strtolower(trim($customer->email ?? ''));
            if ($canteenUser && !empty($canteenUser->email) && filter_var($canteenUser->email, FILTER_VALIDATE_EMAIL)) {
                // Jangan duplikasi jika pembeli dan pemilik kantin menggunakan email yang persis sama
                if (strtolower(trim($canteenUser->email)) !== $customerEmail) {
                    try {
                        Mail::to($canteenUser->email)->send(new CanteenOrderCompletedMail($order));
                        Log::info("[SendOrderCompletedNotificationJob] Email pesanan selesai sukses dikirim ke Kantin ({$canteenUser->email}) untuk pesanan #{$order->id}");
                    } catch (\Throwable $e) {
                        Log::error("[SendOrderCompletedNotificationJob] Gagal mengirim email ke Kantin ({$canteenUser->email}) untuk pesanan #{$order->id}: " . $e->getMessage());
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error("[SendOrderCompletedNotificationJob] Error utama saat memproses notifikasi pesanan #{$this->orderId}: " . $e->getMessage());
        }
    }
}
