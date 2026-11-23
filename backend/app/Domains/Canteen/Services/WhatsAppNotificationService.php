<?php

namespace App\Domains\Canteen\Services;

use App\Domains\Auth\User;
use App\Domains\Canteen\Order;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppNotificationService
{
    /**
     * Send a WhatsApp message via configured gateway (e.g., Fonnte).
     * Never throws exceptions to avoid disrupting critical order/payment flows.
     */
    public static function sendMessage(?string $phone, string $message): bool
    {
        if (!filter_var(env('WHATSAPP_ENABLED', false), FILTER_VALIDATE_BOOLEAN)) {
            return false;
        }

        $token = trim((string) env('WHATSAPP_API_TOKEN', ''));
        $gatewayUrl = trim((string) env('WHATSAPP_GATEWAY_URL', 'https://api.fonnte.com/send'));

        if ($token === '' || !$phone) {
            return false;
        }

        $formattedPhone = self::formatPhone($phone);
        if (!$formattedPhone) {
            return false;
        }

        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'Authorization' => $token,
                ])
                ->post($gatewayUrl, [
                    'target' => $formattedPhone,
                    'message' => $message,
                    'countryCode' => '62',
                ]);

            if ($response->successful()) {
                return true;
            }

            Log::warning('WhatsApp Gateway non-2xx response', [
                'phone' => $formattedPhone,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('WhatsApp Gateway failed: ' . $e->getMessage(), [
                'phone' => $formattedPhone,
            ]);
        }

        return false;
    }

    /**
     * Normalize Indonesian phone number to 628...
     */
    public static function formatPhone(?string $phone): ?string
    {
        if (!$phone) {
            return null;
        }
        $clean = preg_replace('/[^0-9]/', '', $phone);
        if ($clean === '') {
            return null;
        }
        if (str_starts_with($clean, '08')) {
            $clean = '628' . substr($clean, 2);
        } elseif (str_starts_with($clean, '8')) {
            $clean = '628' . substr($clean, 1);
        }
        return strlen($clean) >= 10 ? $clean : null;
    }

    /**
     * Notify Wali when a new order/checkout is created.
     */
    public static function notifyOrderCreated(Order $order, ?string $checkoutCode = null, ?float $grandTotal = null): void
    {
        $phone = $order->recipient_phone ?: ($order->user->phone ?? null);
        if (!$phone) {
            return;
        }

        $santri = $order->recipient_santri_name ?: ($order->user->santri_name ?? 'Ananda');
        $room = $order->recipient_santri_room ?: ($order->delivery_location ?: '-');
        $code = $checkoutCode ?: ($order->checkout_code ?: ('#' . $order->id));
        $totalText = $grandTotal !== null ? ('Rp ' . number_format($grandTotal, 0, ',', '.')) : ('Rp ' . number_format((float) $order->total_price, 0, ',', '.'));

        $msg = "*HIGO PONDOK — Pesanan Diterima*\n\n"
            . "Assalamu'alaikum Bapak/Ibu Wali,\n"
            . "Pesanan *{$code}* untuk *{$santri}* (Asrama/Kamar: {$room}) sebesar *{$totalText}* telah kami terima.\n\n"
            . "⏰ *Info Pengantaran Pondok:*\n"
            . "Kurir bergerak setelah Maghrib & pembagian ke kamar santri dilakukan pukul *20.00 – 21.00 WIB* setelah aktivitas belajar malam selesai.\n\n"
            . "Terima kasih, semoga barokah!";

        self::sendMessage($phone, $msg);
    }

    /**
     * Notify Wali when courier starts delivering to dorms.
     */
    public static function notifyOrderDelivering(Order $order): void
    {
        $phone = $order->recipient_phone ?: ($order->user->phone ?? null);
        if (!$phone) {
            return;
        }

        $santri = $order->recipient_santri_name ?: ($order->user->santri_name ?? 'Ananda');
        $courierName = $order->courier->name ?? 'Kurir Pondok';

        $msg = "*HIGO PONDOK — Sedang Diantar Kurir*\n\n"
            . "Assalamu'alaikum,\n"
            . "Pesanan *#{$order->id}* untuk *{$santri}* sedang dalam perjalanan pengantaran ke asrama oleh *{$courierName}*.\n\n"
            . "Bukti foto penyerahan akan diunggah setelah pembagian di asrama selesai.";

        self::sendMessage($phone, $msg);
    }

    /**
     * Notify Wali when order is completed & delivered to santri.
     */
    public static function notifyOrderCompleted(Order $order): void
    {
        $phone = $order->recipient_phone ?: ($order->user->phone ?? null);
        if (!$phone) {
            return;
        }

        $santri = $order->recipient_santri_name ?: ($order->user->santri_name ?? 'Ananda');
        $room = $order->recipient_santri_room ?: ($order->delivery_location ?: '-');
        $appUrl = rtrim((string) config('app.url', 'https://higopondok.id'), '/');

        $msg = "*HIGO PONDOK — Pesanan Telah Diterima*\n\n"
            . "Alhamdulillah, pesanan *#{$order->id}* untuk *{$santri}* ({$room}) telah selesai diserahkan.\n"
            . "Silakan cek foto bukti serah terima di aplikasi Higo Pondok:\n"
            . "{$appUrl}/pembayaran\n\n"
            . "Terima kasih telah mempercayakan kebutuhan santri bersama Higo Pondok.";

        self::sendMessage($phone, $msg);
    }

    /**
     * Notify Wali when wallet top-up is approved.
     */
    public static function notifyWalletTopupApproved(User $user, float $amount): void
    {
        if (!$user->phone) {
            return;
        }

        $amtStr = 'Rp ' . number_format($amount, 0, ',', '.');
        $balStr = 'Rp ' . number_format((float) $user->balance, 0, ',', '.');
        $santri = $user->santri_name ?: $user->name;

        $msg = "*HIGO WALLET — Top Up Berhasil*\n\n"
            . "Assalamu'alaikum Bapak/Ibu Wali,\n"
            . "Top-up Saldo Uang Saku Higo Wallet untuk *{$santri}* sebesar *{$amtStr}* telah disetujui.\n"
            . "Saldo aktif saat ini: *{$balStr}*.\n\n"
            . "Saldo dapat langsung digunakan untuk checkout pesanan tanpa perlu upload bukti transfer berulang kali.";

        self::sendMessage($user->phone, $msg);
    }
}
