<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

require base_path('app/Domains/Auth/Routes/api.php');
require base_path('app/Domains/Canteen/Routes/api.php');
require base_path('app/Domains/DatabaseSync/Routes/api.php');

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use App\Domains\DatabaseSync\Services\DatabaseSyncService;

/**
 * Helper otorisasi utilitas sistem (Super Admin via Sanctum ATAU Secret Key Sinkronisasi)
 */
$authorizeSystemUtility = function (Request $request): bool {
    $user = $request->user('sanctum');
    if ($user && $user->hasRole('super_admin')) {
        return true;
    }
    $token = $request->header('X-Sync-Secret')
        ?: $request->input('secret')
        ?: $request->cookie('higo_sys_secret');
    return DatabaseSyncService::validateToken($token);
};

Route::get('/buat-symlink-storage', function (Request $request) use ($authorizeSystemUtility) {
    if (!$authorizeSystemUtility($request)) {
        return response()->json(['status' => 'error', 'message' => 'Unauthorized: Hanya Super Admin yang diizinkan.'], 403);
    }

    try {
        // Coba jalankan lewat Artisan
        $exitCode = Artisan::call('storage:link');
        $output = Artisan::output();

        // Cek juga ketersediaan folder fisik
        $target = storage_path('app/public');
        $link = public_path('storage');

        $manualCreated = false;
        if (!file_exists($link)) {
            if (function_exists('symlink')) {
                $manualCreated = @symlink($target, $link);
            }
        }

        return response()->json([
            'status' => 'sukses',
            'artisan_exit_code' => $exitCode,
            'artisan_output' => trim($output),
            'target_exists' => file_exists($target),
            'link_exists' => file_exists($link) || is_link($link),
            'manual_symlink' => $manualCreated,
            'message' => 'Symlink storage berhasil diproses! Silakan buka kembali gambar bukti.'
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Gagal memproses symlink storage.'
        ], 500);
    }
});

Route::get('/gdrive/test', function (Request $request) use ($authorizeSystemUtility) {
    if (!$authorizeSystemUtility($request)) {
        return response()->json(['status' => 'error', 'message' => 'Unauthorized: Hanya Super Admin yang diizinkan.'], 403);
    }

    if ($request->boolean('clear_cache')) {
        try {
            Artisan::call('config:clear');
        } catch (\Throwable $e) {
            // ignore
        }
    }

    $results = [
        'default_disk' => config('filesystems.default'),
        'has_client_id' => !empty(config('filesystems.disks.google.clientId')),
        'has_client_secret' => !empty(config('filesystems.disks.google.clientSecret')),
        'has_refresh_token' => !empty(config('filesystems.disks.google.refreshToken')),
        'shared_folder_id' => config('filesystems.disks.google.sharedFolderId'),
    ];

    try {
        $testFile = '01_master_toko/test_ping_' . time() . '.txt';
        \Illuminate\Support\Facades\Storage::disk('google')->put($testFile, 'HigoPondok VPS GDrive Ping ' . now());
        $exists = \Illuminate\Support\Facades\Storage::disk('google')->exists($testFile);
        $url = \Illuminate\Support\Facades\Storage::disk('google')->url($testFile);
        \Illuminate\Support\Facades\Storage::disk('google')->delete($testFile);

        $results['write_test'] = 'success';
        $results['read_test'] = $exists ? 'success' : 'failed';
        $results['url_test'] = $url;
        $results['status'] = 'READY_AND_WORKING';
        $results['message'] = 'Integrasi Google Drive di server aktif dan berfungsi 100%!';
    } catch (\Throwable $e) {
        $results['write_test'] = 'error';
        $results['error_message'] = $e->getMessage();
        $results['status'] = 'NEEDS_CONFIGURATION';
        if (empty($results['has_refresh_token'])) {
            $results['action_needed'] = 'Buka /api/gdrive/connect?secret=<SYNC_SECRET_KEY> di browser untuk menghubungkan akun Google Drive';
        }
    }

    return response()->json($results);
});

Route::get('/gdrive/connect', function (Request $request) use ($authorizeSystemUtility) {
    if (!$authorizeSystemUtility($request)) {
        return response()->json(['status' => 'error', 'message' => 'Unauthorized: Hanya Super Admin yang diizinkan.'], 403);
    }

    $client = new \Google\Client();
    $client->setClientId(config('filesystems.disks.google.clientId'));
    $client->setClientSecret(config('filesystems.disks.google.clientSecret'));
    $client->setRedirectUri(url('/api/gdrive/callback'));
    $client->setAccessType('offline');
    $client->setPrompt('consent');
    $client->addScope(\Google\Service\Drive::DRIVE);
    $client->setState(hash_hmac('sha256', 'gdrive_oauth_state', (string) config('app.key')));

    $authUrl = $client->createAuthUrl();
    return redirect($authUrl)->withCookie(cookie('higo_sys_secret', DatabaseSyncService::getSecretKey(), 15, '/', null, true, true));
});

Route::get('/gdrive/callback', function (Request $request) use ($authorizeSystemUtility) {
    $expectedState = hash_hmac('sha256', 'gdrive_oauth_state', (string) config('app.key'));
    $validState = $request->has('state') && hash_equals($expectedState, (string) $request->query('state'));

    if (!$validState && !$authorizeSystemUtility($request)) {
        return response()->json(['status' => 'error', 'message' => 'Unauthorized OAuth callback state.'], 403);
    }

    if (!$request->has('code')) {
        return response()->json(['error' => 'No code provided by Google.'], 400);
    }

    $client = new \Google\Client();
    $client->setClientId(config('filesystems.disks.google.clientId'));
    $client->setClientSecret(config('filesystems.disks.google.clientSecret'));
    $client->setRedirectUri(url('/api/gdrive/callback'));

    $token = $client->fetchAccessTokenWithAuthCode($request->query('code'));

    if (isset($token['error'])) {
        return response()->json([
            'status' => 'error',
            'message' => 'Gagal mendapatkan token: ' . ($token['error_description'] ?? $token['error'])
        ], 500);
    }

    $refreshToken = $token['refresh_token'] ?? null;
    if (!$refreshToken) {
        return response()->json([
            'status' => 'warning',
            'message' => 'Google tidak mengembalikan refresh_token. Pastikan prompt=consent diatur dan coba lagi.',
        ]);
    }

    // Sanitasi karakter baris baru sebelum menulis ke .env (cegah .env injection)
    $safeRefreshToken = preg_replace('/[\r\n\0]/', '', (string) $refreshToken);

    // Auto-update .env with the new refresh token
    $envPath = base_path('.env');
    $envContent = file_get_contents($envPath);
    if (str_contains($envContent, 'GOOGLE_DRIVE_REFRESH_TOKEN=')) {
        $envContent = preg_replace('/^GOOGLE_DRIVE_REFRESH_TOKEN=.*$/m', 'GOOGLE_DRIVE_REFRESH_TOKEN=' . $safeRefreshToken, $envContent);
    } else {
        $envContent .= "\nGOOGLE_DRIVE_REFRESH_TOKEN=" . $safeRefreshToken . "\n";
    }
    file_put_contents($envPath, $envContent, LOCK_EX);

    // Clear and rebuild config cache so the new token takes effect immediately on VPS
    try {
        Artisan::call('config:clear');
        Artisan::call('config:cache');
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('gdrive/callback config:cache warning: ' . $e->getMessage());
    }

    return response('<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;">' .
        '<h2 style="color:green;">&#10004; Google Drive Berhasil Terhubung!</h2>' .
        '<p>Refresh Token telah otomatis tersimpan di backend <code>.env</code>.</p>' .
        '<p>Sistem upload sekarang sudah siap menggunakan Google Drive.</p>' .
        '<p>Anda dapat menutup halaman ini sekarang.</p>' .
        '</body></html>', 200, ['Content-Type' => 'text/html']);
});

