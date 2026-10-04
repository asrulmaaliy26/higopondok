<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use App\Domains\Auth\User;

class Voucher extends Model
{
    protected $fillable = [
        'code',
        'title',
        'description',
        'discount_type',
        'discount_amount',
        'min_purchase',
        'canteen_id',
        'created_by_user_id',
        'target_type',
        'target_user_ids',
        'quota',
        'claimed_count',
        'valid_until',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'discount_amount' => 'float',
            'min_purchase' => 'float',
            'quota' => 'integer',
            'claimed_count' => 'integer',
            'valid_until' => 'datetime',
            'is_active' => 'boolean',
            'target_user_ids' => 'array',
        ];
    }

    public function canteen(): BelongsTo
    {
        return $this->belongsTo(Canteen::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function userVouchers(): HasMany
    {
        return $this->hasMany(UserVoucher::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_vouchers')
            ->withPivot(['claimed_at', 'is_used', 'used_at', 'order_id'])
            ->withTimestamps();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->where('valid_until', '>=', now());
    }

    public function isExpired(): bool
    {
        return $this->valid_until && $this->valid_until->isPast();
    }

    public function isEligibleForUser(?int $userId): bool
    {
        if (!$userId) return false;
        if ($this->target_type === 'all') return true;
        if ($this->target_type === 'specific' && is_array($this->target_user_ids)) {
            return in_array((int)$userId, array_map('intval', $this->target_user_ids), true);
        }
        return false;
    }
}

