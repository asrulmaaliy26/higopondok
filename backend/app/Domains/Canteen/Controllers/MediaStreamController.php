<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MediaStreamController extends Controller
{
    /**
     * Proxy stream Google Drive files securely and cache locally
     * so that browser <img> tags and previews can load them without CORS or 403 blocks.
     */
    public function stream(Request $request)
    {
        $fileId = $request->query('id');
        $rawUrl = $request->query('url');

        if (!$fileId && $rawUrl) {
            if (preg_match('/[?&]id=([a-zA-Z0-9_-]{15,100})/', $rawUrl, $matches)) {
                $fileId = $matches[1];
            } elseif (preg_match('/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{15,100})/', $rawUrl, $matches)) {
                $fileId = $matches[1];
            }
        }

        if (!$fileId || !preg_match('/^[a-zA-Z0-9_-]{15,100}$/', $fileId)) {
            return response()->json(['error' => 'Invalid or missing Google Drive file ID'], 400);
        }

        $cacheDir = storage_path('app/drive_cache');
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }

        $cacheFile = $cacheDir . '/' . $fileId . '.bin';
        $metaFile = $cacheDir . '/' . $fileId . '.meta';

        // 1. If cached, serve immediately (1-2ms response time)
        if (file_exists($cacheFile) && filesize($cacheFile) > 0) {
            $mime = file_exists($metaFile) ? trim(file_get_contents($metaFile)) : 'image/jpeg';
            return response()->file($cacheFile, [
                'Content-Type' => $mime,
                'Cache-Control' => 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin' => '*',
                'Content-Disposition' => 'inline; filename="gdrive_' . $fileId . '.jpg"',
                'X-Drive-Cache' => 'HIT'
            ]);
        }

        // 2. Not cached: fetch file content
        $content = null;
        $mime = 'image/jpeg';

        // Attempt A: Use Google Drive API client if configured
        try {
            $config = config('filesystems.disks.google');
            if (!empty($config['clientId']) && !empty($config['clientSecret']) && !empty($config['refreshToken'])) {
                $client = new \Google\Client();
                $client->setClientId($config['clientId']);
                $client->setClientSecret($config['clientSecret']);
                $client->refreshToken($config['refreshToken']);
                $service = new \Google\Service\Drive($client);

                $fileMeta = $service->files->get($fileId, ['fields' => 'mimeType, size', 'supportsAllDrives' => true]);
                if (!empty($fileMeta->mimeType)) {
                    $mime = $fileMeta->mimeType;
                }

                $response = $service->files->get($fileId, ['alt' => 'media', 'supportsAllDrives' => true]);
                $content = $response->getBody()->getContents();
            }
        } catch (\Throwable $e) {
            Log::warning("MediaStreamController Google Client error for {$fileId}: " . $e->getMessage());
        }

        // Attempt B: Fallback via HTTP cURL if client failed or not configured
        if (!$content) {
            $candidateUrls = [
                "https://drive.google.com/thumbnail?id={$fileId}&sz=w1600",
                "https://lh3.googleusercontent.com/d/{$fileId}",
                "https://drive.google.com/uc?id={$fileId}&export=media",
            ];

            foreach ($candidateUrls as $url) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_TIMEOUT => 10,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ]);
                $result = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
                curl_close($ch);

                if ($httpCode === 200 && $result && strlen($result) > 200) {
                    $content = $result;
                    if ($contentType && !str_contains($contentType, 'text/html')) {
                        $mime = explode(';', $contentType)[0];
                    }
                    break;
                }
            }
        }

        if (!$content) {
            return response()->json(['error' => 'Unable to retrieve file from Google Drive'], 404);
        }

        // Save to disk cache for lightning-fast future loads
        @file_put_contents($cacheFile, $content);
        @file_put_contents($metaFile, $mime);

        return response($content, 200, [
            'Content-Type' => $mime,
            'Content-Length' => strlen($content),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin' => '*',
            'Content-Disposition' => 'inline; filename="gdrive_' . $fileId . '.jpg"',
            'X-Drive-Cache' => 'MISS'
        ]);
    }
}
