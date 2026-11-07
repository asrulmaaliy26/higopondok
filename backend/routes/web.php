<?php

use Illuminate\Support\Facades\Route;

// Serve public storage files directly (fallback if symlink is missing on hosting server)
Route::get('/storage/{path}', function ($path) {
    // Cegah Path Traversal (tolak .., \, atau karakter null byte)
    $cleanPath = ltrim(str_replace('\\', '/', (string) $path), '/');
    if ($cleanPath === '' || str_contains($cleanPath, '..') || str_contains($cleanPath, "\0")) {
        abort(403, 'Invalid storage path');
    }

    $basePublicDir = realpath(storage_path('app/public'));
    $filePath = storage_path('app/public/' . $cleanPath);
    $realFilePath = realpath($filePath);

    if (!$realFilePath || !$basePublicDir || !str_starts_with($realFilePath, $basePublicDir . DIRECTORY_SEPARATOR) || is_dir($realFilePath)) {
        try {
            if (\Illuminate\Support\Facades\Storage::disk('google')->exists($cleanPath)) {
                return redirect(\Illuminate\Support\Facades\Storage::disk('google')->url($cleanPath));
            }
        } catch (\Throwable $e) {
            // fallback to 404
        }
        abort(404, 'File not found');
    }
    
    $lastModified = filemtime($realFilePath);
    $etag = md5($lastModified . filesize($realFilePath));
    
    $ifModifiedSince = request()->header('If-Modified-Since');
    $ifNoneMatch = request()->header('If-None-Match');
    
    if (($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) || 
        ($ifModifiedSince && strtotime($ifModifiedSince) >= $lastModified)) {
        return response('', 304);
    }

    return response()->file($realFilePath, [
        'Cache-Control' => 'public, max-age=31536000, immutable',
        'ETag' => '"' . $etag . '"',
        'Last-Modified' => gmdate('D, d M Y H:i:s', $lastModified) . ' GMT',
        'X-Content-Type-Options' => 'nosniff',
    ]);
})->where('path', '.*');

// Tangkap semua route selain /api dan /storage, arahkan ke frontend React
Route::get('/{any}', function () {
    if (view()->exists('react_app')) {
        return view('react_app');
    }
    return "Tolong jalankan deployment agar file react_app.blade.php ter-generate.";
})->where('any', '.*');

