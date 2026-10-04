<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use App\Domains\Auth\User;

class CanteenWithdrawal extends Model
{
    protected $fillable = [
        'canteen_id',
        'admin_id',
        'amount',
        'notes',
    ];

    protected $casts = [
        'amount' => 'float',
    ];

    public function canteen()
    {
        return $this->belongsTo(Canteen::class);
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
