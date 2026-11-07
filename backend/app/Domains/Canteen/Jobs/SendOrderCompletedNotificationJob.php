<?php

namespace App\Domains\Canteen\Jobs;

use App\Domains\Canteen\Mail\CustomerOrderCompletedMail;
use App\Domains\Canteen\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendOrderCompletedNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 60;

    /**
     * Domain dummy / lokal yang tidak boleh dikirimi email SMTP nyata
     */
    private const IGNORED_DOMAINS = [
        'email.com',
        'example.com',
        'test.com',
        'localhost',
        'higopondok.id',
        'invalid',
    ];

    public function __construct(public int $orderId)
    {
    }

    /**
     * Normalisasi dan validasi alamat email untuk mencegah salah ketik umum (seperti awalan www.)
     */
    public static function normalizeAndValidateEmail(?string $rawEmail): ?string
    {
        if (empty($rawEmail)) {
            return null;
        }

        $email = strtolower(trim($rawEmail));

        // Hapus awalan 'www.' jika user tidak sengaja mengetik www.nama@gmail.com
        if (str_starts_with($email, 'www.')) {
            $email = substr($email, 4);
        }

        // Perbaiki salah ketik umum domain gmail
        if (str_ends_with($email, '@gmail')) {
            $email .= '.com';
        } elseif (
            str_ends_with($email, '@gmail.co') ||
            str_ends_with($email, '@gmail.con') ||
            str_ends_with($email, '@gamil.com') ||
            str_ends_with($email, '@gmai.com')
        ) {
            $parts = explode('@', $email);
            if (count($parts) === 2) {
                $email = $parts[0] . '@gmail.com';
            }
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        $domain = substr(strrchr($email, '@'), 1);
        if (!$domain || in_array($domain, self::IGNORED_DOMAINS, true)) {
            return null;
        }

        return $email;
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

            // Jika pesanan ini bagian dari wadah gabungan (checkout_id), pastikan seluruh toko dalam wadah sudah selesai
            // dan cukup kirim 1 email gabungan per wadah agar tidak spam atau bounce berkali-kali.
            if (!empty($order->checkout_id)) {
                $hasIncompleteSibling = Order::where('checkout_id', $order->checkout_id)
                    ->whereNotIn('status', ['completed', 'cancelled'])
                    ->exists();

                if ($hasIncompleteSibling) {
                    Log::info("[SendOrderCompletedNotificationJob] Wadah {$order->checkout_id} masih memiliki toko yang belum selesai. Menunggu seluruh toko selesai sebelum kirim 1 email gabungan.");
                    return;
                }

                $lockKey = "completed_email_sent_checkout_{$order->checkout_id}";
                if (!Cache::add($lockKey, true, now()->addHours(12))) {
                    Log::info("[SendOrderCompletedNotificationJob] Email gabungan untuk wadah {$order->checkout_id} sudah dikirim. Skip duplikat Order #{$order->id}.");
                    return;
                }
            } else {
                $lockKey = "completed_email_sent_order_{$order->id}";
                if (!Cache::add($lockKey, true, now()->addHours(12))) {
                    return;
                }
            }

            // Validasi & bersihkan alamat email Pembeli (Santri / Wali Santri)
            $customer = $order->user;
            $rawEmail = $customer?->email;
            $cleanEmail = self::normalizeAndValidateEmail($rawEmail);

            if (!$cleanEmail) {
                Log::info("[SendOrderCompletedNotificationJob] Skip kirim email untuk Order #{$order->id}: Email '{$rawEmail}' kosong atau domain dummy.");
                return;
            }

            // Cek apakah email sedang dalam masa Temporary Cooldown (3 hari) akibat kegagalan pengiriman sebelumnya
            $cooldownKey = 'email_bounce_cooldown_' . md5($cleanEmail);
            if (Cache::has($cooldownKey)) {
                Log::info("[SendOrderCompletedNotificationJob] Skip sementara kirim email ke {$cleanEmail} (sedang dalam masa cooldown 3 hari).");
                return;
            }

            try {
                Mail::to($cleanEmail)->send(new CustomerOrderCompletedMail($order));
                Log::info("[SendOrderCompletedNotificationJob] Email pesanan selesai sukses dikirim ke Pembeli ({$cleanEmail}) untuk pesanan #{$order->id}");
            } catch (\Throwable $e) {
                // Tahan sementara (cooldown 3 hari) agar tidak terus-menerus memicu error, lalu otomatis buka kembali setelah 3 hari
                Cache::put($cooldownKey, true, now()->addDays(3));
                Log::error("[SendOrderCompletedNotificationJob] Gagal mengirim email ke Pembeli ({$cleanEmail}) untuk pesanan #{$order->id} (masuk cooldown 3 hari): " . $e->getMessage());
            }
        } catch (\Throwable $e) {
            Log::error("[SendOrderCompletedNotificationJob] Error utama saat memproses notifikasi pesanan #{$this->orderId}: " . $e->getMessage());
        }
    }
}
