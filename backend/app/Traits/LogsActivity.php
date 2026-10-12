<?php

namespace App\Traits;

use App\Domains\Admin\ActivityLog;
use Illuminate\Support\Facades\Auth;

trait LogsActivity
{
    protected static ?\WeakMap $activityChangesMap = null;

    protected static function getActivityChangesMap(): \WeakMap
    {
        if (self::$activityChangesMap === null) {
            self::$activityChangesMap = new \WeakMap();
        }
        return self::$activityChangesMap;
    }

    protected static function bootLogsActivity()
    {
        static::created(function ($model) {
            self::logAction($model, 'created');
        });

        static::updating(function ($model) {
            $changes = [];
            $ignored = ['updated_at', 'remember_token', 'created_at'];
            foreach ($model->getDirty() as $field => $newValue) {
                if (in_array($field, $ignored)) {
                    continue;
                }
                $changes[$field] = [
                    'old' => $model->getOriginal($field),
                    'new' => $newValue,
                ];
            }
            self::getActivityChangesMap()[$model] = $changes;
        });

        static::updated(function ($model) {
            $map = self::getActivityChangesMap();
            $changes = isset($map[$model]) ? $map[$model] : [];
            unset($map[$model]);
            self::logAction($model, 'updated', $changes);
        });

        static::deleted(function ($model) {
            self::logAction($model, 'deleted');
        });
    }

    protected static function logAction($model, $action, array $changes = [])
    {
        $userId = Auth::check() ? Auth::id() : null;
        
        // Deteksi spesifik jika aksi adalah pembatalan pesanan
        if ($action === 'updated' && isset($changes['status']) && $changes['status']['new'] === 'cancelled') {
            $action = 'cancelled';
        }

        $description = self::generateDescription($model, $action, $changes);

        ActivityLog::create([
            'user_id' => $userId,
            'action' => $action,
            'model_type' => class_basename($model),
            'model_id' => $model->id ?? null,
            'description' => $description,
        ]);
    }

    protected static function generateDescription($model, $action, array $changes = []): string
    {
        $modelName = class_basename($model);
        $identifier = $model->name ?? $model->title ?? ($model->id ? "#{$model->id}" : 'Data');

        if ($action === 'created') {
            return self::describeCreated($model, $modelName, $identifier);
        }

        if ($action === 'deleted') {
            return self::describeDeleted($model, $modelName, $identifier);
        }

        if ($action === 'updated') {
            return self::describeUpdated($model, $modelName, $identifier, $changes);
        }

        return "{$action} {$modelName}: {$identifier}";
    }

    protected static function describeCreated($model, string $modelName, string $identifier): string
    {
        if ($modelName === 'Product') {
            $info = [];
            if (!empty($model->category)) {
                $info[] = "Kategori: {$model->category}";
            }
            if (!empty($model->price)) {
                $info[] = "Harga: Rp " . number_format((float)$model->price, 0, ',', '.');
            }
            if (isset($model->stock)) {
                $info[] = "Stok: {$model->stock}";
            }
            return "Menambahkan menu baru: '{$identifier}'" . (!empty($info) ? " (" . implode(', ', $info) . ")" : "");
        }

        if ($modelName === 'Canteen') {
            $cat = !empty($model->category) ? " (Kategori: {$model->category})" : '';
            return "Mendaftarkan toko/kantin baru: '{$identifier}'{$cat}";
        }

        if ($modelName === 'Order') {
            $total = !empty($model->total_amount) ? " (Total: Rp " . number_format((float)$model->total_amount, 0, ',', '.') . ")" : '';
            return "Membuat pesanan baru #{$model->id}{$total}";
        }

        if ($modelName === 'User') {
            return "Mendaftarkan akun baru: '{$identifier}'" . (!empty($model->email) ? " ({$model->email})" : "");
        }

        return "Menambahkan {$modelName} baru: {$identifier}";
    }

    protected static function describeDeleted($model, string $modelName, string $identifier): string
    {
        if ($modelName === 'Product') {
            return "Menghapus menu: '{$identifier}'";
        }
        if ($modelName === 'Canteen') {
            return "Menghapus toko/kantin: '{$identifier}'";
        }
        if ($modelName === 'Order') {
            return "Menghapus pesanan #{$model->id}";
        }
        if ($modelName === 'User') {
            return "Menghapus akun pengguna: '{$identifier}'";
        }

        return "Menghapus {$modelName}: {$identifier}";
    }

    protected static function describeUpdated($model, string $modelName, string $identifier, array $changes): string
    {
        if (empty($changes)) {
            return "Memperbarui {$modelName}: {$identifier}";
        }

        $details = [];

        foreach ($changes as $field => $c) {
            $old = $c['old'];
            $new = $c['new'];

            switch ($field) {
                // Harga & Keuangan
                case 'price':
                case 'hpj':
                    $details[] = "mengubah harga jual dari Rp " . number_format((float)$old, 0, ',', '.') . " menjadi Rp " . number_format((float)$new, 0, ',', '.');
                    break;

                case 'hpp':
                    $details[] = "mengubah modal (HPP) dari Rp " . number_format((float)$old, 0, ',', '.') . " menjadi Rp " . number_format((float)$new, 0, ',', '.');
                    break;

                case 'discount_price':
                    $details[] = "mengubah harga promo/diskon menjadi Rp " . number_format((float)$new, 0, ',', '.');
                    break;

                case 'delivery_fee':
                    $details[] = "mengubah ongkir dari Rp " . number_format((float)$old, 0, ',', '.') . " ke Rp " . number_format((float)$new, 0, ',', '.');
                    break;

                case 'admin_fee':
                    $details[] = "mengubah biaya admin dari Rp " . number_format((float)$old, 0, ',', '.') . " ke Rp " . number_format((float)$new, 0, ',', '.');
                    break;

                // Kategori & Nama
                case 'category':
                    $oldText = !empty($old) ? $old : '-';
                    $newText = !empty($new) ? $new : '-';
                    $details[] = "mengubah kategori dari '{$oldText}' menjadi '{$newText}'";
                    break;

                case 'name':
                    $details[] = "mengubah nama dari '{$old}' menjadi '{$new}'";
                    break;

                // Stok & Ketersediaan
                case 'stock':
                    $details[] = "mengubah stok dari {$old} menjadi {$new}";
                    break;

                case 'is_available':
                    $details[] = "mengubah status ketersediaan menjadi " . ($new ? 'Tersedia' : 'Habis');
                    break;

                case 'is_open':
                    $details[] = "mengubah status toko menjadi " . ($new ? 'BUKA' : 'TUTUP');
                    break;

                // Jam Operasional
                case 'open_time':
                case 'close_time':
                    $openStr = substr($model->open_time ?? '00:00', 0, 5);
                    $closeStr = substr($model->close_time ?? '00:00', 0, 5);
                    $details[] = "mengubah jam operasional menjadi {$openStr} - {$closeStr}";
                    break;

                // Media / Upload Foto
                case 'image':
                case 'avatar':
                    if (empty($old) && !empty($new)) {
                        $details[] = "mengunggah foto baru";
                    } elseif (!empty($old) && empty($new)) {
                        $details[] = "menghapus foto";
                    } else {
                        $details[] = "memperbarui foto";
                    }
                    break;

                // Deskripsi & Catatan
                case 'description':
                    $details[] = "memperbarui deskripsi/catatan";
                    break;

                case 'variant_config':
                    $details[] = "memperbarui konfigurasi opsi & varian menu";
                    break;

                // Status Pesanan & Pembayaran
                case 'status':
                    if ($new === 'cancelled') {
                        $details[] = "MEMBATALKAN pesanan (status diubah dari '" . ($old ?: 'aktif') . "' menjadi 'Dibatalkan')";
                    } elseif ($new === 'completed') {
                        $details[] = "MENYELESAIKAN pesanan (status diubah menjadi 'Selesai')";
                    } elseif ($new === 'processing') {
                        $details[] = "MEMPROSES pesanan (status diubah menjadi 'Sedang Diproses')";
                    } else {
                        $details[] = "mengubah status pesanan dari '" . ($old ?: '-') . "' menjadi '{$new}'";
                    }
                    break;

                case 'payment_status':
                    $details[] = "mengubah status pembayaran dari '" . ($old ?: '-') . "' menjadi '{$new}'";
                    break;

                case 'courier_id':
                    $oldCourierName = $old ? (\App\Domains\Auth\User::find($old)?->name ?? "Kurir #{$old}") : 'Tanpa Kurir';
                    $newCourierName = $new ? (\App\Domains\Auth\User::find($new)?->name ?? "Kurir #{$new}") : 'Antar Sendiri';
                    if ($old && $new) {
                        $details[] = "memindahkan tugas kurir dari '{$oldCourierName}' ke '{$newCourierName}'";
                    } elseif ($new) {
                        $details[] = "menugaskan kurir '{$newCourierName}'";
                    } else {
                        $details[] = "mencabut penugasan kurir (diantar sendiri oleh toko)";
                    }
                    break;

                case 'canteen_id':
                    $oldCanteenName = $old ? (\App\Domains\Canteen\Canteen::find($old)?->name ?? "Toko #{$old}") : '-';
                    $newCanteenName = $new ? (\App\Domains\Canteen\Canteen::find($new)?->name ?? "Toko #{$new}") : '-';
                    $details[] = "memindahkan pesanan dari toko '{$oldCanteenName}' ke '{$newCanteenName}'";
                    break;

                case 'delivery_location':
                    $details[] = "mengubah lokasi pengantaran menjadi '{$new}'";
                    break;

                case 'proof_of_payment':
                    $details[] = "mengunggah bukti pembayaran transfer";
                    break;

                case 'proof_of_delivery':
                    $details[] = "mengunggah bukti pengiriman kurir";
                    break;

                case 'is_priority':
                    $details[] = $new ? "menandai pesanan sebagai Prioritas" : "menghapus status Prioritas";
                    break;

                // User profile
                case 'phone':
                    $details[] = "mengubah nomor HP menjadi '{$new}'";
                    break;

                case 'santri_room':
                    $details[] = "mengubah kamar santri menjadi '{$new}'";
                    break;

                case 'santri_class':
                    $details[] = "mengubah kelas santri menjadi '{$new}'";
                    break;

                case 'is_teacher':
                    $details[] = $new ? "menetapkan sebagai dewan guru" : "mencabut status dewan guru";
                    break;

                case 'is_working':
                    $details[] = $new ? "mengubah status kerja kurir menjadi Aktif" : "mengubah status kerja kurir menjadi Istirahat";
                    break;

                default:
                    // Lewatkan field internal jika ada
                    if (!in_array($field, ['password', 'id'])) {
                        $details[] = "mengubah {$field}";
                    }
                    break;
            }
        }

        // Hapus duplikasi jika ada
        $details = array_unique($details);

        if (empty($details)) {
            return "Memperbarui {$modelName}: {$identifier}";
        }

        $label = match($modelName) {
            'Product' => 'Menu',
            'Canteen' => 'Toko/Kantin',
            'Order' => 'Pesanan',
            'User' => 'Pengguna',
            default => $modelName
        };

        return "Memperbarui {$label} '{$identifier}': " . implode(', ', $details);
    }
}
