<?php

namespace App\Domains\Canteen\Mail;

use App\Domains\Canteen\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CanteenOrderCompletedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "💰 [Higo Pondok] Pesanan #ORD-{$this->order->id} Selesai - Saldo Masuk ke Toko Anda"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.order_completed_canteen',
            with: [
                'order' => $this->order,
                'user' => $this->order->user,
                'canteen' => $this->order->canteen,
                'courier' => $this->order->courier,
                'items' => $this->order->items,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
