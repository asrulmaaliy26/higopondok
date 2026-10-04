<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Domains\Auth\User;

class UserVoucher extends Model
{
    protected $fillable = [
        'user_id',
        'voucher_id',
        'claimed_at',
        'is_used',
        'used_at',
        'order_id'
    ];

    protected function casts(): array
    {
        return [
            'is_used' => 'boolean',
            'claimed_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}

