<?php

namespace App\Domains\Canteen\Mail;

use App\Domains\Canteen\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SpecialOrderNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
    }

    public function envelope(): Envelope
    {
        $santriName = $this->order->recipient_santri_name ?: ($this->order->user?->name ?: 'Santri');
        $canteenName = $this->order->canteen?->name ?? 'Kantin Barokah Pusat';

        return new Envelope(
            subject: "✨ [Pesanan Khusus Masuk] #ORD-{$this->order->id} - {$santriName} ({$canteenName})"
        );
    }

    public function content(): Content
    {
        $adminBaseUrl = rtrim(config('app.url', 'https://higopondok.id'), '/');

        return new Content(
            view: 'emails.special_order_notification',
            with: [
                'order' => $this->order,
                'adminUrl' => "{$adminBaseUrl}/admin/pesanan",
            ]
        );
    }
}
