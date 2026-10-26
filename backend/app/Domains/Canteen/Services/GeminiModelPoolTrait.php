<?php

namespace App\Domains\Canteen\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

trait GeminiModelPoolTrait
{
    /**
     * Seluruh pool model Gemini yang didukung dan diurutkan dari kuota terbesar & terhemat (500 RPD) ke terkecil (20 RPD)
     */
    protected array $allSupportedModels = [
        'gemini-3.5-flash-lite',     // Kuota 500 RPD, 15 RPM (Paling direkomendasikan & paling lega)
        'gemini-3.1-flash-lite',     // Kuota 500 RPD, 15 RPM (Cadangan utama kecepatan tinggi)
        'gemini-2.5-flash-lite',     // Kuota 20 RPD, 10 RPM (Versi lite stabil)
        'gemini-2.5-flash',          // Kuota 20 RPD, 5 RPM (Versi standard)
        'gemini-2.0-flash',          // Kuota 20 RPD
        'gemini-flash-lite-latest',  // Dynamic rolling alias Google
        'gemini-3-flash-preview',    // Model preview generasi 3
        'gemini-3.8-flash',          // Kuota 20 RPD (Paling akhir sebagai pelindung)
    ];

    /**
     * Dapatkan daftar kunci API Gemini yang aktif.
     * Mendukung Multi-Key dipisahkan koma di .env (misal: GEMINI_API_KEY=key1,key2,key3)
     */
    public function getActiveApiKeys(): array
    {
        $rawKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY', '');
        if (empty($rawKey)) {
            return [];
        }

        $keys = array_filter(array_map('trim', explode(',', $rawKey)));
        $activeKeys = [];

        foreach ($keys as $k) {
            $keyHash = substr(md5($k), 0, 8);
            if (!Cache::has("gemini_key_limit_{$keyHash}")) {
                $activeKeys[] = $k;
            }
        }

        // Jika semua key tercatat limit, coba gunakan seluruh key kembali sebagai fallback darurat
        return !empty($activeKeys) ? array_values($activeKeys) : array_values($keys);
    }

    /**
     * Dapatkan kunci API utama (backward-compatibility)
     */
    public function getApiKey(): ?string
    {
        $keys = $this->getActiveApiKeys();
        return $keys[0] ?? (config('services.gemini.api_key') ?: env('GEMINI_API_KEY'));
    }

    /**
     * Dapatkan model yang sedang aktif dan tidak dalam masa cooldown rate limit
     */
    public function getAvailableModels(): array
    {
        $active = [];
        foreach ($this->allSupportedModels as $model) {
            if (!Cache::has("gemini_model_limit_{$model}")) {
                $active[] = $model;
            }
        }

        // Jika semua model kebetulan masuk cooldown, gunakan model Lite berkuota 500 RPD
        if (empty($active)) {
            return ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
        }

        return $active;
    }

    /**
     * Tandai model tertentu sedang terkena rate limit (HTTP 429 / Quota Exceeded)
     * Model akan di-cooldown selama $minutes menit di cache agar request lain langsung loncat ke model sehat
     */
    public function recordModelRateLimit(string $model, int $minutes = 30): void
    {
        Log::warning("[GeminiPool] Model {$model} mencapai batas kuota (Rate Limit). Cooldown selama {$minutes} menit diaktifkan.");
        Cache::put("gemini_model_limit_{$model}", true, now()->addMinutes($minutes));
    }

    /**
     * Tandai kunci API tertentu sedang terkena limit
     */
    public function recordKeyRateLimit(string $key, int $minutes = 30): void
    {
        $keyHash = substr(md5($key), 0, 8);
        Log::warning("[GeminiPool] API Key [***{$keyHash}] terkena limit. Mengalihkan ke API Key cadangan.");
        Cache::put("gemini_key_limit_{$keyHash}", true, now()->addMinutes($minutes));
    }
}
