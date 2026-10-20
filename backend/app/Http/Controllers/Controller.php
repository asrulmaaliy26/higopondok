<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * Get the dynamic upload path based on user role and name.
     * Format: {role}_{nama_pengguna} (all spaces replaced with underscore and lowercase).
     * Example: kantin_budi_santoso
     * 
     * @param \App\Models\User|\Illuminate\Foundation\Auth\User $user
     * @param string|null $subFolder Optional subfolder, e.g., 'products', 'avatars'
     * @return string
     */
    protected function getUserUploadPath($user, $subFolder = null)
    {
        $rolesStr = 'user';
        if ($user && method_exists($user, 'roles') && $user->roles) {
            $roles = $user->roles->pluck('name')->map(function($r) {
                return strtolower(str_replace(' ', '_', $r));
            })->toArray();
            
            if (!empty($roles)) {
                $rolesStr = implode('_', $roles);
            }
        }

        $userName = 'guest';
        if ($user) {
            $nameToUse = $user->santri_name ?: $user->name;
            if ($nameToUse) {
                $userName = strtolower(str_replace(' ', '_', $nameToUse));
                $userName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userName);
                $userName = trim(preg_replace('/_+/', '_', $userName), '_') ?: 'user';
            }
        }

        $rolesStr = preg_replace('/[^a-zA-Z0-9_-]/', '_', $rolesStr);
        $userFolder = $rolesStr . '_' . $userName;

        // Standarisasi Google Drive:
        // 01_master_toko: foto toko/canteen, banner kantin, avatar profil
        // 02_katalog_produk: foto katalog produk makanan & barang
        if ($subFolder === 'products') {
            return "02_katalog_produk/{$userFolder}";
        }

        if (in_array($subFolder, ['canteens', 'banners', 'avatars'])) {
            return "01_master_toko/{$userFolder}/{$subFolder}";
        }

        return "01_master_toko/{$userFolder}" . ($subFolder ? "/{$subFolder}" : "");
    }

    /**
     * Store and optimize/compress image files automatically.
     * Resizes large images (max 1600px) and compresses quality to 80% using PHP GD.
     * Falls back to normal store() if not a compressible image or if GD fails.
     * 
     * @param \Illuminate\Http\UploadedFile $file
     * @param \App\Models\User|\Illuminate\Foundation\Auth\User $user
     * @param string|null $subFolder
     * @param string $disk
     * @return string
     */
    protected function storeOptimizedImage($file, $user, $subFolder = null, $disk = null, $dirOverride = null)
    {
        $disk = $disk ?: config('filesystems.default', 'public');
        $dir = $dirOverride ?: $this->getUserUploadPath($user, $subFolder);
        $mime = $file->getMimeType() ?: '';
        $isImage = str_starts_with($mime, 'image/');

        $resolveReturn = function ($storedPath) use ($disk) {
            if ($disk === 'google') {
                try {
                    $url = \Illuminate\Support\Facades\Storage::disk('google')->url($storedPath);
                    if ($url) {
                        return $url;
                    }
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning("Google Drive URL generation fallback: " . $e->getMessage());
                }
            }
            return $storedPath;
        };
        
        // If not an image or GD is not available, store directly
        if (!extension_loaded('gd') || !$isImage) {
            $stored = $file->store($dir, $disk);
            return $resolveReturn($stored);
        }

        // High-Concurrency Fast-Path:
        // If image is already lightweight (<= 512 KB, pre-compressed by client Canvas),
        // store directly with random name to save 90%+ server CPU & memory.
        if ($file->getSize() <= 512 * 1024) {
            $ext = strtolower($file->getClientOriginalExtension()) ?: 'jpg';
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                $ext = 'jpg';
            }
            $filename = \Illuminate\Support\Str::random(40) . '.' . $ext;
            $stored = $file->storeAs($dir, $filename, $disk);
            return $resolveReturn($stored);
        }

        try {
            $pathname = $file->getPathname();
            $imageContent = file_get_contents($pathname);
            $srcImg = @imagecreatefromstring($imageContent);

            if (!$srcImg) {
                $stored = $file->store($dir, $disk);
                return $resolveReturn($stored);
            }

            $origWidth = imagesx($srcImg);
            $origHeight = imagesy($srcImg);

            $maxWidth = 1600;
            $maxHeight = 1600;

            $newWidth = $origWidth;
            $newHeight = $origHeight;

            if ($origWidth > $maxWidth || $origHeight > $maxHeight) {
                if ($origWidth > $origHeight) {
                    $newHeight = (int) round(($origHeight * $maxWidth) / $origWidth);
                    $newWidth = $maxWidth;
                } else {
                    $newWidth = (int) round(($origWidth * $maxHeight) / $origHeight);
                    $newHeight = $maxHeight;
                }
            }

            $targetImg = imagecreatetruecolor($newWidth, $newHeight);

            // Handle transparency for PNG / WebP
            imagealphablending($targetImg, false);
            imagesavealpha($targetImg, true);
            $transparent = imagecolorallocatealpha($targetImg, 255, 255, 255, 127);
            imagefilledrectangle($targetImg, 0, 0, $newWidth, $newHeight, $transparent);
            imagealphablending($targetImg, true);

            imagecopyresampled($targetImg, $srcImg, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);

            // Output to memory buffer as WebP or JPEG
            ob_start();
            if (function_exists('imagewebp')) {
                imagewebp($targetImg, null, 80);
                $ext = 'webp';
            } else {
                imagejpeg($targetImg, null, 80);
                $ext = 'jpg';
            }
            $compressedData = ob_get_clean();

            imagedestroy($srcImg);
            imagedestroy($targetImg);

            $filename = \Illuminate\Support\Str::random(40) . '.' . $ext;
            $fullPath = $dir . '/' . $filename;

            \Illuminate\Support\Facades\Storage::disk($disk)->put($fullPath, $compressedData);

            return $resolveReturn($fullPath);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Image optimization fallback: " . $e->getMessage());
            $stored = $file->store($dir, $disk);
            return $resolveReturn($stored);
        }
    }

    /**
     * Dapatkan format folder bukti pesanan per hari, nama user, dan jenis bukti:
     * Contoh:
     *   - senin18Januari2025/ahmad_zaki/proof
     *   - senin18Januari2025/ahmad_zaki/proff_delivery
     *   - senin18Januari2025/ahmad_zaki/proff_kantin
     * 
     * @param \App\Domains\Canteen\Order $order
     * @param string $proofType ('proof', 'proff_delivery', 'proff_kantin')
     * @param string|\Carbon\Carbon|null $date
     * @return string
     */
    protected function getOrderProofUploadPath($order, $proofType = 'proof', $date = null): string
    {
        $carbon = $date 
            ? \Carbon\Carbon::parse($date)->setTimezone('Asia/Jakarta')
            : ($order && $order->created_at ? \Carbon\Carbon::parse($order->created_at)->setTimezone('Asia/Jakarta') : \Carbon\Carbon::now('Asia/Jakarta'));

        $days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
        ];

        $dayName = $days[$carbon->dayOfWeek];
        $dayNum = $carbon->day;
        $monthName = $months[$carbon->month];
        $year = $carbon->year;

        $dateFolder = "{$dayName}{$dayNum}{$monthName}{$year}";

        $targetUser = $order ? ($order->user ?? null) : null;
        $userName = 'user';
        if ($targetUser) {
            $nameToUse = $targetUser->santri_name ?: $targetUser->name;
            if ($nameToUse) {
                $userName = strtolower(str_replace(' ', '_', $nameToUse));
                $userName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userName);
                $userName = trim(preg_replace('/_+/', '_', $userName), '_') ?: 'user';
            }
        }

        $subFolder = match(strtolower($proofType)) {
            'delivery', 'proff_delivery', 'proof_delivery', 'proof_of_delivery' => 'proff_delivery',
            'purchase', 'canteen', 'kantin', 'proff_kantin', 'proof_kantin', 'proof_of_purchase' => 'proff_kantin',
            default => 'proof',
        };

        // Standarisasi Google Drive:
        // 03_bukti_transaksi: bukti bayar santri, bukti kirim kurir, struk belanja kantin
        return "03_bukti_transaksi/{$dateFolder}/{$userName}/{$subFolder}";
    }

    /**
     * Simpan file bukti pesanan dengan format folder dinamis per hari dan nama user.
     *
     * @param \Illuminate\Http\UploadedFile $file
     * @param \App\Domains\Canteen\Order $order
     * @param string $proofType
     * @param string $disk
     * @return string
     */
    protected function storeOrderProofImage($file, $order, $proofType = 'proof', $disk = null)
    {
        $disk = $disk ?: config('filesystems.default', 'public');
        $dir = $this->getOrderProofUploadPath($order, $proofType);
        return $this->storeOptimizedImage($file, null, null, $disk, $dir);
    }

    /**
     * Upload / pindahkan bukti pembayaran dari disk lokal ke Google Drive
     * saat status pesanan diverifikasi / diubah menjadi lunas.
     *
     * @param \App\Domains\Canteen\Order $order
     * @param string $proofField ('proof_of_payment', 'proof_of_purchase', 'proof_of_delivery')
     * @return array Updated proofs
     */
    public function syncProofToGoogleDrive($order, string $proofField = 'proof_of_payment'): array
    {
        $proofs = $order->{$proofField};
        if (empty($proofs)) {
            return [];
        }

        $proofList = is_array($proofs) ? $proofs : [$proofs];
        $updatedProofs = [];
        $changed = false;

        $hasGoogleDisk = !empty(config('filesystems.disks.google.clientId')) || config('filesystems.default') === 'google';

        foreach ($proofList as $path) {
            if (!is_string($path)) {
                $updatedProofs[] = $path;
                continue;
            }

            // Jika sudah berupa Google Drive URL, pertahankan
            if (str_contains($path, 'drive.google.com') || str_contains($path, 'drive-stream') || !$hasGoogleDisk) {
                $updatedProofs[] = $path;
                continue;
            }

            // Bersihkan path lokal di disk public
            $cleanPath = ltrim(str_replace(['/storage/', 'storage/'], '', $path), '/');

            try {
                if (\Illuminate\Support\Facades\Storage::disk('public')->exists($cleanPath)) {
                    $content = \Illuminate\Support\Facades\Storage::disk('public')->get($cleanPath);
                    
                    // Upload ke Google Drive
                    \Illuminate\Support\Facades\Storage::disk('google')->put($cleanPath, $content);
                    $driveUrl = \Illuminate\Support\Facades\Storage::disk('google')->url($cleanPath);

                    if ($driveUrl) {
                        $updatedProofs[] = $driveUrl;
                        $changed = true;
                        continue;
                    }
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("[syncProofToGoogleDrive] Gagal upload {$cleanPath} ke Google Drive: " . $e->getMessage());
            }

            $updatedProofs[] = $path;
        }

        if ($changed) {
            $order->{$proofField} = $updatedProofs;
            $order->save();

            // Jika ada checkout_id, sinkronkan ke pesanan terkait
            if (!empty($order->checkout_id)) {
                \App\Domains\Canteen\Order::where('checkout_id', $order->checkout_id)
                    ->where('id', '!=', $order->id)
                    ->update([$proofField => json_encode($updatedProofs)]);
            }
        }

        return $updatedProofs;
    }
}

