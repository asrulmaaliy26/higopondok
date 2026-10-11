<?php

namespace App\Domains\Auth;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use App\Traits\LogsActivity;

use Illuminate\Database\Eloquent\Casts\Attribute;

#[Fillable(['name', 'email', 'phone', 'password', 'santri_name', 'santri_room', 'santri_class', 'santri_level', 'penalty_points', 'google_id', 'avatar', 'balance', 'is_working', 'is_teacher', 'niy', 'teacher_unit'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, HasRoles, LogsActivity;

    protected $appends = ['role'];

    /**
     * Aksesor eksplisit atribut role dengan prioritas hierarki
     */
    public function getRoleAttribute(): string
    {
        $roleNames = $this->relationLoaded('roles')
            ? $this->roles->pluck('name')->toArray()
            : $this->roles()->pluck('name')->toArray();

        if (in_array('super_admin', $roleNames)) {
            return 'super_admin';
        }
        if (in_array('admin', $roleNames)) {
            return 'admin';
        }
        if (in_array('kantin', $roleNames)) {
            return 'kantin';
        }
        if (in_array('kurir', $roleNames)) {
            return 'kurir';
        }
        return $roleNames[0] ?? 'user';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'balance' => 'float',
            'penalty_points' => 'integer',
            'is_working' => 'boolean',
            'is_teacher' => 'boolean',
        ];
    }

    /**
     * Otomatis normalisasi format nomor HP / WhatsApp ke 628...
     */
    protected function phone(): Attribute
    {
        return Attribute::make(
            set: function ($value) {
                if (!$value) return null;
                $clean = preg_replace('/[^0-9]/', '', (string)$value);
                if (str_starts_with($clean, '08')) {
                    $clean = '628' . substr($clean, 2);
                } elseif (str_starts_with($clean, '8')) {
                    $clean = '628' . substr($clean, 1);
                }
                return $clean ?: null;
            }
        );
    }

    public function canteens()
    {
        return $this->hasMany(\App\Domains\Canteen\Canteen::class);
    }

    public function assignedCanteens(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(\App\Domains\Canteen\Canteen::class, 'canteen_couriers', 'courier_id', 'canteen_id')->withTimestamps();
    }

    protected static function booted()
    {
        static::deleting(function (User $user) {
            // Hapus avatar jika ada
            if ($user->avatar) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->avatar);
            }
            
            // Hapus paksa semua kantin milik user agar file fisiknya juga ikut terhapus
            // Ini akan mentrigger event forceDeleting di model Canteen
            $user->canteens()->each(function ($canteen) {
                $canteen->forceDelete();
            });
            
            // Driver tidak memiliki file gambar saat ini, namun jika ada di masa depan, 
            // DB cascade sudah mengaturnya.
        });
    }
}
