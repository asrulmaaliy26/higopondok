<?php

namespace App\Domains\Canteen\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CanteenResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $product_income = 0;
        $delivery_income = 0;

        if ($this->relationLoaded('orders')) {
            $completedOrders = $this->orders->where('status', 'completed');
            
            foreach ($completedOrders as $order) {
                // Product income is the sum of all item subtotals for this order
                $itemsTotal = ($order->items && $order->items->count() > 0) ? $order->items->sum('subtotal') : (float) $order->total_price;
                $product_income += $itemsTotal;
                
                // If it was delivered by the canteen itself (no courier_id)
                // The canteen keeps the delivery fee which is:
                // total_price - items_total
                if (is_null($order->courier_id)) {
                    $delivery_fee = $order->total_price - $itemsTotal;
                    $delivery_income += max(0, $delivery_fee);
                }
            }
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'description' => $this->description,
            'image' => $this->image,
            'status' => $this->status,
            'is_open' => $this->is_open,
            'is_force_closed' => (bool) $this->is_force_closed,
            'open_time' => $this->open_time,
            'close_time' => $this->close_time,
            'rating' => $this->rating,
            'rating_count' => $this->rating_count,
            'delivery_fee' => $this->delivery_fee,
            'admin_fee' => $this->admin_fee,
            'pending_orders_count' => $this->whenCounted('pending_orders_count', 0),
            'admin_debt' => $this->admin_debt,
            'sold_count' => $this->sold_count,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'whatsapp_number' => $this->whatsapp_number,
            'distance' => $this->distance, // if calculated in query
            'product_income' => $product_income,
            'delivery_income' => $delivery_income,
            'products' => $this->whenLoaded('products'),
            'banners' => $this->whenLoaded('banners'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
