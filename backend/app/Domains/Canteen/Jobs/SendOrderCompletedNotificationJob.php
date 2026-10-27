<?php

namespace App\Domains\Canteen\Jobs;

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
            $order = Order::with(['user', 'canteen', 'courier', 'items.product'])->find($this->orderId);

            if (!$order) {
                Log::warning("[SendOrderCompletedNotificationJob] Order #{$this->orderId} tidak ditemukan.");
                return;
            }

            // Pastikan pesanan berstatus completed
            if ($order->status !== 'completed') {
                Log::info("[SendOrderCompletedNotificationJob] Order #{$this->orderId} status bukan completed ({$order->status}). Batal kirim email.");
                return;
            }

            // Notifikasi hanya dikirim ke Pembeli (Santri / Wali Santri)
            $customer = $order->user;
            if ($customer && !empty($customer->email) && filter_var($customer->email, FILTER_VALIDATE_EMAIL)) {
                try {
                    Mail::to($customer->email)->send(new CustomerOrderCompletedMail($order));
                    Log::info("[SendOrderCompletedNotificationJob] Email pesanan selesai sukses dikirim ke Pembeli ({$customer->email}) untuk pesanan #{$order->id}");
                } catch (\Throwable $e) {
                    Log::error("[SendOrderCompletedNotificationJob] Gagal mengirim email ke Pembeli ({$customer->email}) untuk pesanan #{$order->id}: " . $e->getMessage());
                }
            }
        } catch (\Throwable $e) {
            Log::error("[SendOrderCompletedNotificationJob] Error utama saat memproses notifikasi pesanan #{$this->orderId}: " . $e->getMessage());
        }
    }
}
