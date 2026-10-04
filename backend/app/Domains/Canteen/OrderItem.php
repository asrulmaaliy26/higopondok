<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'quantity',
        'price',
        'subtotal',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price' => 'float',
        'subtotal' => 'float',
    ];

    protected $appends = [
        'hpp',
        'total_hpp',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * HPP per unit (dari produk, atau fallback HPJ - 1.000)
     */
    public function getHppAttribute(): float
    {
        if ($this->relationLoaded('product') && $this->product) {
            return (float) ($this->product->hpp ?? ($this->price > 1000 ? ($this->price - 1000.0) : (float) $this->price));
        }
        $price = (float) $this->price;
        return $price > 1000 ? ($price - 1000.0) : $price;
    }

    /**
     * Total HPP untuk seluruh quantity baris item ini
     */
    public function getTotalHppAttribute(): float
    {
        return $this->hpp * (int) $this->quantity;
    }

    /**
     * Subtotal nominal riil (HPJ * quantity)
     */
    public function getSubtotalAmountAttribute(): float
    {
        if ((float) $this->subtotal > 0) {
            return (float) $this->subtotal;
        }
        return (float) $this->price * (int) $this->quantity;
    }

    /**
     * Laba kotor toko untuk baris item ini (HPJ - HPP)
     */
    public function getProfitAttribute(): float
    {
        return $this->subtotal_amount - $this->total_hpp;
    }
}
