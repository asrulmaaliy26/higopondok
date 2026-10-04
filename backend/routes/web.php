<?php

use Illuminate\Support\Facades\Route;

// Serve public storage files directly (fallback if symlink is missing on hosting server)
Route::get('/storage/{path}', function ($path) {
    $filePath = storage_path('app/public/' . $path);
    if (!file_exists($filePath)) {
        abort(404, 'File not found');
    }
    
    $lastModified = filemtime($filePath);
    $etag = md5($lastModified . filesize($filePath));
    
    $ifModifiedSince = request()->header('If-Modified-Since');
    $ifNoneMatch = request()->header('If-None-Match');
    
    if (($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) || 
        ($ifModifiedSince && strtotime($ifModifiedSince) >= $lastModified)) {
        return response('', 304);
    }

    return response()->file($filePath, [
        'Cache-Control' => 'public, max-age=31536000, immutable',
        'ETag' => '"' . $etag . '"',
        'Last-Modified' => gmdate('D, d M Y H:i:s', $lastModified) . ' GMT',
    ]);
})->where('path', '.*');

// Tangkap semua route selain /api dan /storage, arahkan ke frontend React
Route::get('/{any}', function () {
    if (view()->exists('react_app')) {
        return view('react_app');
    }
    return "Tolong jalankan deployment agar file react_app.blade.php ter-generate.";
})->where('any', '.*');

