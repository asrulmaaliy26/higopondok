<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;

class CanteenBalanceLedger extends Model
{
    use HasFactory;

    protected $table = 'canteen_balance_ledgers';

    protected $fillable = [
        'canteen_id',
        'order_id',
        'type',
        'amount',
        'balance_before',
        'balance_after',
        'description',
    ];

    protected $casts = [
        'amount' => 'float',
        'balance_before' => 'float',
        'balance_after' => 'float',
    ];

    public function canteen()
    {
        return $this->belongsTo(Canteen::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Helper static untuk mencatat mutasi buku kas kantin
     */
    public static function record($canteen, string $type, float $amount, string $description, ?int $orderId = null)
    {
        $balanceBefore = (float)$canteen->balance;
        $isIncome = in_array(strtolower($type), ['in', 'credit', 'pemasukan']);
        $balanceAfter = $isIncome ? ($balanceBefore + $amount) : ($balanceBefore - $amount);

        return self::create([
            'canteen_id' => $canteen->id,
            'order_id' => $orderId,
            'type' => $isIncome ? 'in' : 'out',
            'amount' => $amount,
            'balance_before' => $balanceBefore,
            'balance_after' => max(0, $balanceAfter),
            'description' => $description,
        ]);
    }
}
