<?php

namespace App\Domains\Admin;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Domains\Auth\User;
use Carbon\Carbon;

class AdminExpense extends Model
{
    use HasFactory;

    protected $table = 'admin_expenses';

    protected $fillable = [
        'admin_id',
        'expense_date',
        'title',
        'category',
        'amount',
        'payment_method',
        'recipient',
        'notes',
        'proof_image',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date:Y-m-d',
            'amount' => 'float',
        ];
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    /**
     * Scope untuk memfilter pengeluaran berdasarkan periode tanggal (konsisten dengan Order::scopeFilterPeriod)
     */
    public function scopeFilterPeriod($query, ?string $period = 'month', ?string $startDate = null, ?string $endDate = null)
    {
        if ($startDate && $endDate) {
            $start = Carbon::parse($startDate, 'Asia/Jakarta')->toDateString();
            $end = Carbon::parse($endDate, 'Asia/Jakarta')->toDateString();
            return $query->whereBetween('expense_date', [$start, $end]);
        }

        if ($period === 'all') {
            return $query;
        }

        if ($period === 'day') {
            $targetDate = $startDate ?: now('Asia/Jakarta')->toDateString();
            return $query->whereDate('expense_date', $targetDate);
        }

        if ($period === 'week') {
            return $query->whereBetween('expense_date', [
                now('Asia/Jakarta')->startOfWeek()->toDateString(),
                now('Asia/Jakarta')->endOfWeek()->toDateString(),
            ]);
        }

        if ($period === 'year') {
            return $query->whereYear('expense_date', now('Asia/Jakarta')->year);
        }

        // Default: month (bulan berjalan)
        return $query->whereMonth('expense_date', now('Asia/Jakarta')->month)
                     ->whereYear('expense_date', now('Asia/Jakarta')->year);
    }

    public static function getCategories(): array
    {
        return [
            'operasional' => 'Operasional Harian',
            'server_it' => 'Server, Hosting & Domain',
            'insentif_kurir' => 'Bonus / Insentif Kurir & Tim',
            'perlengkapan' => 'Kertas Struk, Plastik & ATK',
            'promosi_marketing' => 'Promosi, Banner & Subsidi',
            'sosial_pondok' => 'Kontribusi / Kas Pondok',
            'lainnya' => 'Pengeluaran Lain-lain',
        ];
    }
}

