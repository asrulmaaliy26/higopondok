<?php

namespace App\Domains\Auth;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Domains\Canteen\Order;

class WalletTransaction extends Model
{
    protected $table = 'wallet_transactions';

    protected $fillable = [
        'user_id',
        'type',
        'amount',
        'balance_before',
        'balance_after',
        'status',
        'order_id',
        'proof_image',
        'description',
        'admin_notes',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'balance_before' => 'float',
            'balance_after' => 'float',
            'approved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }
}
