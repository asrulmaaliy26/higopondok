<?php

namespace App\Traits;

use App\Domains\Admin\ActivityLog;
use Illuminate\Support\Facades\Auth;

trait LogsActivity
{
    protected static function bootLogsActivity()
    {
        static::created(function ($model) {
            self::logAction($model, 'created');
        });

        static::updated(function ($model) {
            self::logAction($model, 'updated');
        });

        static::deleted(function ($model) {
            self::logAction($model, 'deleted');
        });
    }

    protected static function logAction($model, $action)
    {
        $userId = Auth::check() ? Auth::id() : null;
        
        $description = self::generateDescription($model, $action);

        ActivityLog::create([
            'user_id' => $userId,
            'action' => $action,
            'model_type' => class_basename($model),
            'model_id' => $model->id ?? null,
            'description' => $description,
        ]);
    }

    protected static function generateDescription($model, $action)
    {
        $modelName = class_basename($model);
        
        // Coba mencari field yang bisa jadi representasi nama (name, title)
        $identifier = $model->name ?? $model->title ?? $model->id ?? 'Data';

        if ($action === 'created') {
            return "Menambahkan {$modelName} baru: {$identifier}";
        } elseif ($action === 'updated') {
            return "Memperbarui {$modelName}: {$identifier}";
        } elseif ($action === 'deleted') {
            return "Menghapus {$modelName}: {$identifier}";
        }

        return "{$action} {$modelName}: {$identifier}";
    }
}
