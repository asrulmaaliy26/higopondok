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
