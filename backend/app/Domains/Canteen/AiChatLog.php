<?php

namespace App\Domains\Canteen;

use App\Domains\Auth\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiChatLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'session_id',
        'raw_message',
        'normalized_message',
        'model_used',
        'intent',
        'is_order_ready',
        'ai_response_text',
        'extracted_data',
        'is_converted',
        'order_id',
        'user_feedback',
        'feedback_notes',
        'ip_address',
    ];

    /**
     * Tipe data casts
     */
    protected function casts(): array
    {
        return [
            'is_order_ready' => 'boolean',
            'is_converted' => 'boolean',
            'extracted_data' => 'array',
        ];
    }

    /**
     * Relasi ke santri / user pengirim
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relasi ke order yang terbentuk jika pesanan berhasil checkout
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Local Scope: Chat yang sukses terkonversi jadi pesanan
     */
    public function scopeConverted($query)
    {
        return $query->where('is_converted', true);
    }

    /**
     * Local Scope: Filter berdasarkan intent
     */
    public function scopeIntent($query, string $intent)
    {
        return $query->where('intent', $intent);
    }
}
