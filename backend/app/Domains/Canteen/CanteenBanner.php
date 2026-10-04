<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CanteenBanner extends Model
{
    protected $fillable = [
        'canteen_id',
        'image_path',
        'title',
        'status',
    ];

    public function canteen(): BelongsTo
    {
        return $this->belongsTo(Canteen::class);
    }

    protected static function booted()
    {
        static::deleting(function (CanteenBanner $banner) {
            if ($banner->image_path) {
                // Remove /storage/ prefix if it exists in the path
                $path = str_replace('/storage/', '', $banner->image_path);
                \Illuminate\Support\Facades\Storage::disk('public')->delete($path);
            }
        });
    }
}
