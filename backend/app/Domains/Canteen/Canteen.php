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
        'closed_days',
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
        'whatsapp_number',
        'balance'
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'float',
            'delivery_fee' => 'float',
            'delivery_rates' => 'array',
            'admin_fee' => 'float',
            'admin_debt' => 'float',
            'is_gofood_mode' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
            'rating' => 'float',
            'sold_count' => 'integer',
            'rating_count' => 'integer',
            'closed_days' => 'array'
        ];
    }

    protected $appends = ['is_open', 'is_force_closed', 'is_closed_today'];

    public function getIsForceClosedAttribute(): bool
    {
        if (Cache::get('admin_global_canteen_force_closed', false)) {
            return true;
        }
        return (bool) Cache::get('canteen_force_closed_' . $this->id, false);
    }

    public function getIsClosedTodayAttribute(): bool
    {
        if (empty($this->closed_days) || !is_array($this->closed_days)) {
            return false;
        }

        $now = now('Asia/Jakarta');
        $dayOfWeek = $now->dayOfWeek; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
        $dayMap = [
            0 => 'minggu',
            1 => 'senin',
            2 => 'selasa',
            3 => 'rabu',
            4 => 'kamis',
            5 => 'jumat',
            6 => 'sabtu',
        ];
        $todayName = $dayMap[$dayOfWeek] ?? '';
        $todayEnglish = strtolower($now->format('l'));

        $closedDaysNormalized = array_map(function($d) {
            return is_string($d) ? strtolower(trim($d)) : $d;
        }, $this->closed_days);

        return in_array($todayName, $closedDaysNormalized, true)
            || in_array($todayEnglish, $closedDaysNormalized, true)
            || in_array($dayOfWeek, $closedDaysNormalized, true)
            || in_array((string)$dayOfWeek, $closedDaysNormalized, true);
    }

    public function getIsOpenAttribute()
    {
        if ($this->status !== 'approved') return false;
        if ($this->is_force_closed) return false;
        if ($this->is_closed_today) return false;
        
        $now = now('Asia/Jakarta')->format('H:i:s');
        $rawOpen = $this->open_time ?? '06:00:00';
        $rawClose = $this->close_time ?? '21:00:00';

        $open = strlen($rawOpen) === 5 ? $rawOpen . ':00' : $rawOpen;
        $close = strlen($rawClose) === 5 ? $rawClose . ':00' : $rawClose;

        // Buka 24 Jam Penuh (contoh: 00:00 s/d 23:59 atau 00:00 s/d 00:00)
        if ($open === '00:00:00' && in_array($close, ['23:59:00', '23:59:59', '24:00:00', '00:00:00'])) {
            return true;
        }

        if ($open === $close) return false;

        if ($open <= $close) {
            return $now >= $open && $now <= $close;
        } else {
            // Handles crossing midnight (e.g. open 16:00, close 02:00)
            return $now >= $open || $now <= $close;
        }
    }

    public function getWhatsappNumberAttribute($value)
    {
        if (!empty($value)) {
            return $value;
        }
        return $this->user?->phone;
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

        $now = now('Asia/Jakarta');
        $timeNow = $now->format('H:i:s');
        $dayMap = [
            0 => 'minggu',
            1 => 'senin',
            2 => 'selasa',
            3 => 'rabu',
            4 => 'kamis',
            5 => 'jumat',
            6 => 'sabtu',
        ];
        $todayName = $dayMap[$now->dayOfWeek] ?? '';
        $todayEnglish = strtolower($now->format('l'));

        return $query->where('status', 'approved')
            ->where(function($q) use ($todayName, $todayEnglish) {
                $q->whereNull('closed_days')
                  ->orWhere(function($sub) use ($todayName, $todayEnglish) {
                      $sub->whereJsonDoesntContain('closed_days', $todayName)
                          ->whereJsonDoesntContain('closed_days', $todayEnglish);
                  });
            })
            ->where(function($q) use ($timeNow) {
                $q->where(function($q1) use ($timeNow) {
                    $q1->whereRaw('open_time < close_time')
                       ->whereTime('open_time', '<=', $timeNow)
                       ->whereTime('close_time', '>=', $timeNow);
                })->orWhere(function($q2) use ($timeNow) {
                    $q2->whereRaw('open_time > close_time')
                       ->where(function($q3) use ($timeNow) {
                           $q3->whereTime('open_time', '<=', $timeNow)
                              ->orWhereTime('close_time', '>=', $timeNow);
                       });
                })->orWhere(function($q4) {
                    $q4->where('open_time', '00:00:00')
                       ->whereIn('close_time', ['23:59:59', '23:59:00', '24:00:00', '00:00:00']);
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
