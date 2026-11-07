<?php

namespace App\Domains\Admin;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class GoogleDriveAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'client_id',
        'client_secret',
        'refresh_token',
        'folder_id',
        'folder_name',
        'is_active',
        'status',
        'status_message',
        'storage_used',
        'storage_limit',
        'auto_switch_when_full',
        'last_checked_at',
        'notes',
    ];

    protected $hidden = [
        'client_secret',
        'refresh_token',
    ];

    protected $appends = [
        'has_refresh_token',
        'folder_url',
        'usage_percent',
        'storage_used_formatted',
        'storage_limit_formatted',
        'storage_free_formatted',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'storage_used' => 'integer',
            'storage_limit' => 'integer',
            'auto_switch_when_full' => 'boolean',
            'last_checked_at' => 'datetime',
        ];
    }

    // ==========================================
    // LOCAL SCOPES
    // ==========================================

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeConnected($query)
    {
        return $query->where('status', 'connected');
    }

    // ==========================================
    // ACCESSORS & HELPERS
    // ==========================================

    public function getHasRefreshTokenAttribute(): bool
    {
        return !empty($this->refresh_token);
    }

    public function getFolderUrlAttribute(): string
    {
        $fid = $this->folder_id ?: config('filesystems.disks.google.sharedFolderId', '1ksLwc4S9MohrBTH4YISZOEhR5inWIbcH');
        return "https://drive.google.com/drive/folders/{$fid}?usp=sharing";
    }

    public function getUsagePercentAttribute(): float
    {
        if ($this->storage_limit <= 0) {
            return 0.0;
        }
        return round(min(100, ($this->storage_used / $this->storage_limit) * 100), 1);
    }

    public function getStorageUsedFormattedAttribute(): string
    {
        return self::formatBytes($this->storage_used);
    }

    public function getStorageLimitFormattedAttribute(): string
    {
        return self::formatBytes($this->storage_limit);
    }

    public function getStorageFreeFormattedAttribute(): string
    {
        $free = max(0, $this->storage_limit - $this->storage_used);
        return self::formatBytes($free);
    }

    public static function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 MB';
        }
        $gb = $bytes / (1024 * 1024 * 1024);
        if ($gb >= 1) {
            return number_format($gb, 2, ',', '.') . ' GB';
        }
        $mb = $bytes / (1024 * 1024);
        return number_format($mb, 1, ',', '.') . ' MB';
    }

    /**
     * Ekstrak ID Folder dari URL Google Drive atau kembalikan ID langsung
     */
    public static function extractFolderId(?string $input): ?string
    {
        if (empty($input)) {
            return null;
        }
        $trimmed = trim($input);
        if (preg_match('/folders\/([a-zA-Z0-9_-]{15,100})/', $trimmed, $m)) {
            return $m[1];
        }
        if (preg_match('/id=([a-zA-Z0-9_-]{15,100})/', $trimmed, $m)) {
            return $m[1];
        }
        return $trimmed;
    }

    /**
     * Ambil konfigurasi disk Google Drive yang sedang aktif (dari DB atau fallback .env)
     */
    public static function getActiveConfig(): array
    {
        $defaultConfig = config('filesystems.disks.google', []);

        try {
            if (!Schema::hasTable('google_drive_accounts')) {
                return $defaultConfig;
            }

            $active = self::active()->first() ?? self::orderBy('id', 'asc')->first();
            if (!$active) {
                return $defaultConfig;
            }

            return [
                'account_id' => $active->id,
                'account_name' => $active->name,
                'account_email' => $active->email,
                'driver' => 'google',
                'clientId' => $active->client_id ?: ($defaultConfig['clientId'] ?? env('GOOGLE_DRIVE_CLIENT_ID')),
                'clientSecret' => $active->client_secret ?: ($defaultConfig['clientSecret'] ?? env('GOOGLE_DRIVE_CLIENT_SECRET')),
                'refreshToken' => $active->refresh_token ?: ($defaultConfig['refreshToken'] ?? env('GOOGLE_DRIVE_REFRESH_TOKEN')),
                'folder' => '/',
                'sharedFolderId' => $active->folder_id ?: ($defaultConfig['sharedFolderId'] ?? env('GOOGLE_DRIVE_SHARED_FOLDER_ID')),
                'parameters' => [],
            ];
        } catch (\Throwable $e) {
            return $defaultConfig;
        }
    }

    /**
     * Bangun instance \Google\Client untuk akun ini
     */
    public function buildGoogleClient(): \Google\Client
    {
        $defaultConfig = config('filesystems.disks.google', []);
        $clientId = $this->client_id ?: ($defaultConfig['clientId'] ?? env('GOOGLE_DRIVE_CLIENT_ID'));
        $clientSecret = $this->client_secret ?: ($defaultConfig['clientSecret'] ?? env('GOOGLE_DRIVE_CLIENT_SECRET'));
        $refreshToken = $this->refresh_token ?: ($defaultConfig['refreshToken'] ?? env('GOOGLE_DRIVE_REFRESH_TOKEN'));

        $client = new \Google\Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->addScope(\Google\Service\Drive::DRIVE);
        $client->addScope('email');
        $client->addScope('profile');

        if (!empty($refreshToken)) {
            $token = $client->fetchAccessTokenWithRefreshToken($refreshToken);
            if (is_array($token) && isset($token['error'])) {
                throw new \RuntimeException($token['error_description'] ?? $token['error']);
            }
        } else {
            throw new \RuntimeException('Refresh Token belum diatur untuk akun ini.');
        }

        return $client;
    }

    /**
     * Bersihkan instance disk 'google' yang di-cache oleh Laravel Storage Manager
     * agar pergantian akun berlaku seketika tanpa perlu restart server.
     */
    public static function purgeStorageDiskCache(): void
    {
        try {
            \Illuminate\Support\Facades\Storage::forgetDisk('google');
            Cache::forget('active_google_drive_account');
        } catch (\Throwable $e) {
            // Ignore
        }
    }
}

