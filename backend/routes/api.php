<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

require base_path('app/Domains/Auth/Routes/api.php');
require base_path('app/Domains/Canteen/Routes/api.php');
require base_path('app/Domains/DatabaseSync/Routes/api.php');

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

Route::get('/buat-symlink-storage', function () {
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
            'target_path' => $target,
            'link_path' => $link,
            'target_exists' => file_exists($target),
            'link_exists' => file_exists($link) || is_link($link),
            'manual_symlink' => $manualCreated,
            'message' => 'Symlink storage berhasil diproses! Silakan buka kembali gambar bukti.'
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ], 500);
    }
});

Route::get('/gdrive/connect', function () {
    $client = new \Google\Client();
    $client->setClientId(config('filesystems.disks.google.clientId'));
    $client->setClientSecret(config('filesystems.disks.google.clientSecret'));
    $client->setRedirectUri(url('/api/gdrive/callback'));
    $client->setAccessType('offline');
    $client->setPrompt('consent');
    $client->addScope(\Google\Service\Drive::DRIVE);

    $authUrl = $client->createAuthUrl();
    return redirect($authUrl);
});

Route::get('/gdrive/callback', function (Request $request) {
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
            'token' => $token
        ]);
    }

    // Auto-update .env with the new refresh token
    $envPath = base_path('.env');
    $envContent = file_get_contents($envPath);
    if (str_contains($envContent, 'GOOGLE_DRIVE_REFRESH_TOKEN=')) {
        $envContent = preg_replace('/GOOGLE_DRIVE_REFRESH_TOKEN=.*/', 'GOOGLE_DRIVE_REFRESH_TOKEN=' . $refreshToken, $envContent);
    } else {
        $envContent .= "\nGOOGLE_DRIVE_REFRESH_TOKEN=" . $refreshToken . "\n";
    }
    file_put_contents($envPath, $envContent);

    return response('<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;">' .
        '<h2 style="color:green;">&#10004; Google Drive Berhasil Terhubung!</h2>' .
        '<p>Refresh Token telah otomatis tersimpan di backend <code>.env</code>.</p>' .
        '<p>Sistem upload sekarang sudah siap menggunakan Google Drive.</p>' .
        '<p>Anda dapat menutup halaman ini sekarang.</p>' .
        '</body></html>', 200, ['Content-Type' => 'text/html']);
});

