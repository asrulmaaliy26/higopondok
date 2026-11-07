<?php

namespace App\Domains\Admin\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GoogleDriveAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'client_id' => $this->client_id,
            'has_custom_credentials' => !empty($this->client_id) && !empty($this->client_secret),
            'has_refresh_token' => !empty($this->refresh_token),
            'refresh_token_preview' => $this->refresh_token
                ? substr($this->refresh_token, 0, 10) . '...' . substr($this->refresh_token, -6)
                : null,
            'folder_id' => $this->folder_id,
            'folder_name' => $this->folder_name ?: 'Higo Pondok Storage',
            'folder_url' => $this->folder_url,
            'is_active' => (bool) $this->is_active,
            'status' => $this->status,
            'status_message' => $this->status_message,
            'storage_used' => (int) $this->storage_used,
            'storage_limit' => (int) $this->storage_limit,
            'usage_percent' => $this->usage_percent,
            'storage_used_formatted' => $this->storage_used_formatted,
            'storage_limit_formatted' => $this->storage_limit_formatted,
            'storage_free_formatted' => $this->storage_free_formatted,
            'auto_switch_when_full' => (bool) $this->auto_switch_when_full,
            'last_checked_at' => $this->last_checked_at?->toISOString(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}

