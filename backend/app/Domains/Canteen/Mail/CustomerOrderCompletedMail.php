<?php

namespace App\Domains\Canteen\Mail;

use App\Domains\Canteen\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerOrderCompletedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
    }

    public function envelope(): Envelope
    {
        if (!empty($this->order->checkout_id)) {
            $bundleOrders = Order::with('canteen')
                ->where('checkout_id', $this->order->checkout_id)
                ->where('status', 'completed')
                ->get();

            if ($bundleOrders->count() > 1) {
                $storeCount = $bundleOrders->count();
                return new Envelope(
                    subject: "✅ [Higo Pondok] Pesanan Wadah #{$this->order->checkout_id} ({$storeCount} Toko) Telah Selesai & Diterima"
                );
            }
        }

        $canteenName = $this->order->canteen?->name ?? 'Kantin Pondok';
        return new Envelope(
            subject: "✅ [Higo Pondok] Pesanan #ORD-{$this->order->id} Telah Selesai & Diterima ({$canteenName})"
        );
    }

    public function content(): Content
    {
        $bundleOrders = collect([$this->order]);
        if (!empty($this->order->checkout_id)) {
            $fetched = Order::with(['canteen', 'courier', 'items.product'])
                ->where('checkout_id', $this->order->checkout_id)
                ->where('status', 'completed')
                ->orderBy('id', 'asc')
                ->get();
            if ($fetched->isNotEmpty()) {
                $bundleOrders = $fetched;
            }
        }

        return new Content(
            view: 'emails.order_completed_customer',
            with: [
                'order' => $this->order,
                'bundleOrders' => $bundleOrders,
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
