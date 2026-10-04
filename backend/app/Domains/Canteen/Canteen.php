<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Domains\Auth\User;
use App\Traits\LogsActivity;

use Illuminate\Support\Facades\Cache;

class Canteen extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;
    protected $fillable = [
        'user_id',
        'name',
        'category',
        'description',
        'image',
        'status',
        'open_time',
        'close_time',
        'delivery_fee',
        'delivery_rates',
        'admin_fee',
        'admin_debt',
        'is_gofood_mode',
        'sold_count',
        'latitude',
        'longitude',
        'rating',
        'rating_count',
        'whatsapp_number'
    ];

    protected function casts(): array
    {
        return [
            'delivery_fee' => 'float',
            'delivery_rates' => 'array',
            'admin_fee' => 'float',
            'admin_debt' => 'float',
            'is_gofood_mode' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
            'rating' => 'float',
            'sold_count' => 'integer',
            'rating_count' => 'integer'
        ];
    }

    protected $appends = ['is_open', 'is_force_closed'];

    public function getIsForceClosedAttribute(): bool
    {
        if (Cache::get('admin_global_canteen_force_closed', false)) {
            return true;
        }
        return (bool) Cache::get('canteen_force_closed_' . $this->id, false);
    }

    public function getIsOpenAttribute()
    {
        if ($this->status !== 'approved') return false;
        if ($this->is_force_closed) return false;
        
        $now = now('Asia/Jakarta')->format('H:i:s');
        $open = $this->open_time ?? '09:00:00';
        $close = $this->close_time ?? '17:00:00';

        if ($open === $close) return false;

        if ($open <= $close) {
            return $now >= $open && $now <= $close;
        } else {
            // Handles crossing midnight (e.g. open 18:00, close 02:00)
            return $now >= $open || $now <= $close;
        }
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function banners(): HasMany
    {
        return $this->hasMany(CanteenBanner::class);
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }

    public function couriers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'canteen_couriers', 'canteen_id', 'courier_id')->withTimestamps();
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeOpen($query)
    {
        if (Cache::get('admin_global_canteen_force_closed', false)) {
            return $query->whereRaw('1 = 0');
        }

        $now = now('Asia/Jakarta')->format('H:i:s');
        
        return $query->where('status', 'approved')
            ->where(function($q) use ($now) {
                $q->where(function($q1) use ($now) {
                    $q1->whereRaw('open_time < close_time')
                       ->whereTime('open_time', '<=', $now)
                       ->whereTime('close_time', '>=', $now);
                })->orWhere(function($q2) use ($now) {
                    $q2->whereRaw('open_time > close_time')
                       ->where(function($q3) use ($now) {
                           $q3->whereTime('open_time', '<=', $now)
                              ->orWhereTime('close_time', '>=', $now);
                       });
                });
            });
    }

    protected static function booted()
    {
        $cleanup = function (Canteen $canteen) {
            // Hapus gambar fisik kantin
            if ($canteen->image) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($canteen->image);
            }
            
            // Hapus paksa produk dan banner agar file fisik mereka juga ikut terhapus
            $canteen->products()->each(function($product) {
                $product->forceDelete();
            });
            $canteen->banners()->each(function($banner) {
                $banner->delete(); // Banner tidak pakai SoftDeletes, cukup delete()
            });
        };

        static::deleting($cleanup);
        static::forceDeleting($cleanup);
    }
}
