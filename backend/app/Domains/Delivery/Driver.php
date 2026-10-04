<?php

namespace App\Domains\Delivery;

use Illuminate\Database\Eloquent\Model;
use App\Domains\Auth\User;

class Driver extends Model
{
    protected $fillable = [
        'user_id',
        'vehicle_info',
        'status',
        'is_active'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
