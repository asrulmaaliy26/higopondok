<?php

namespace App\Domains\Canteen\Jobs;

use App\Domains\Canteen\Mail\SpecialOrderNotificationMail;
use App\Domains\Canteen\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendSpecialOrderNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Jumlah percobaan maksimal jika terjadi kegagalan koneksi
     */
    public int $tries = 3;

    /**
     * Waktu tunggu antar percobaan (detik)
     */
    public int $backoff = 30;

    public function __construct(public int $orderId)
    {
    }

    public function handle(): void
    {
        try {
            $order = Order::with(['user', 'canteen'])->find($this->orderId);

            if (!$order) {
                Log::warning("[SendSpecialOrderNotificationJob] Pesanan #{$this->orderId} tidak ditemukan. Batal kirim notifikasi email.");
                return;
            }

            // Pastikan ini adalah pesanan khusus
            if (!$order->is_custom) {
                Log::info("[SendSpecialOrderNotificationJob] Pesanan #{$order->id} bukan pesanan khusus (is_custom=false). Skip email notifikasi.");
                return;
            }

            // Deduplikasi agar email tidak terkirim ganda untuk pesanan yang sama
            $lockKey = "special_order_notif_sent_{$order->id}";
            if (!Cache::add($lockKey, true, now()->addHours(24))) {
                Log::info("[SendSpecialOrderNotificationJob] Notifikasi email pesanan khusus #{$order->id} sudah pernah dikirim sebelumnya. Skip duplikat.");
                return;
            }

            // Ambil alamat email tujuan dari config / env dengan hardcoded fallback ke lostsaga06k@gmail.com
            $rawEmail = config('mail.special_order_notification_email')
                ?: env('SPECIAL_ORDER_NOTIFICATION_EMAIL', 'lostsaga06k@gmail.com');

            $cleanEmail = filter_var(trim($rawEmail), FILTER_VALIDATE_EMAIL);
            if (!$cleanEmail) {
                $cleanEmail = 'lostsaga06k@gmail.com';
            }

            Mail::to($cleanEmail)->send(new SpecialOrderNotificationMail($order));
            Log::info("[SendSpecialOrderNotificationJob] Sukses mengirim notifikasi pesanan khusus #{$order->id} ke {$cleanEmail}");
        } catch (\Throwable $e) {
            Log::error("[SendSpecialOrderNotificationJob] Gagal mengirim notifikasi pesanan khusus #{$this->orderId}: " . $e->getMessage(), [
                'exception' => $e
            ]);
        }
    }
}
