<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\LogsActivity;

class Product extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'canteen_id',
        'name',
        'category',
        'description',
        'price',
        'hpp',
        'discount_price',
        'stock',
        'sold_count',
        'rating',
        'rating_count',
        'image',
        'is_available',
        'variant_config',
    ];

    protected $appends = ['hpj'];

    protected function casts(): array
    {
        return [
            'price' => 'float',
            'hpp' => 'float',
            'discount_price' => 'float',
            'stock' => 'integer',
            'is_available' => 'boolean',
            'variant_config' => 'array',
        ];
    }

    public function getHpjAttribute(): float
    {
        return (float) ($this->attributes['price'] ?? 0);
    }

    public function setHpjAttribute($value): void
    {
        $this->attributes['price'] = $value;
    }

    public function getHppAttribute(): float
    {
        if (isset($this->attributes['hpp']) && (float)$this->attributes['hpp'] > 0) {
            return (float) $this->attributes['hpp'];
        }
        $price = (float) ($this->attributes['price'] ?? 0);
        return $price > 1000 ? ($price - 1000) : $price;
    }

    public function canteen()
    {
        return $this->belongsTo(Canteen::class);
    }

    protected static function booted()
    {
        $cleanup = function (Product $product) {
            if ($product->image) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($product->image);
            }
        };

        static::deleting($cleanup);
        static::forceDeleting($cleanup);
    }
}
