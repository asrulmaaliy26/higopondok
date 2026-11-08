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
     * Total biaya tambahan varian/topping per unit (contoh: "Mozarella (+Rp 5.000)").
     * Diambil dari catatan item yang tersimpan saat checkout agar tetap akurat
     * walaupun harga produk/varian diubah di kemudian hari.
     */
    public function getVariantSurchargeAttribute(): float
    {
        $notes = (string) ($this->notes ?? '');
        $fromNotes = 0.0;
        if ($notes !== '') {
            // Catatan lama kadang terduplikasi: "[Porsi Jumbo (+Rp 2.000)] • [Porsi Jumbo (+Rp 2.000)]"
            // -> pecah per segmen "•" dan hitung segmen unik saja agar topping tidak terhitung ganda.
            $segments = array_unique(array_filter(array_map(
                fn($s) => mb_strtolower(trim(preg_replace('/\s+/', ' ', $s))),
                explode('•', $notes)
            )));
            foreach ($segments as $segment) {
                if (preg_match_all('/\+\s*Rp\.?\s*([\d\.,]+)/i', $segment, $m)) {
                    foreach ($m[1] as $raw) {
                        $fromNotes += (float) preg_replace('/[^\d]/', '', $raw);
                    }
                }
            }
        }

        // Fallback: selisih harga item vs harga dasar produk (jika catatan tidak memuat nominal)
        $fromDiff = 0.0;
        if ($this->relationLoaded('product') && $this->product) {
            $basePrice = (float) $this->product->price;
            $discount = (float) ($this->product->discount_price ?? 0);
            if ($discount > 0 && $discount < $basePrice) {
                $basePrice = $discount;
            }
            $fromDiff = max(0.0, (float) $this->price - $basePrice);
        }

        // Ambil nilai terbesar: catatan checkout (akurat walau harga produk diubah belakangan)
        // vs selisih harga (menangkap opsi tambahan yang tidak tertulis di catatan).
        $surcharge = max($fromNotes, $fromDiff);

        // Tidak boleh melebihi harga jual item itu sendiri
        return min($surcharge, max(0.0, (float) $this->price));
    }

    /**
     * HPP per unit.
     * HPP = HPP produk dasar + biaya tambahan varian/topping (topping diteruskan 100% sebagai modal ke toko,
     * sehingga laba toko tetap = HPJ dasar - HPP dasar dan nominal topping ikut terbayar ke toko).
     * Fallback jika produk tidak ada: HPJ - 1.000.
     */
    public function getHppAttribute(): float
    {
        $price = (float) $this->price;

        if ($this->relationLoaded('product') && $this->product) {
            $baseHpp = $this->product->hpp;
            if ($baseHpp === null || (float) $baseHpp <= 0) {
                return $price > 1000 ? ($price - 1000.0) : $price;
            }
            $hpp = (float) $baseHpp + $this->variant_surcharge;
            return min($hpp, $price > 0 ? $price : $hpp);
        }

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
