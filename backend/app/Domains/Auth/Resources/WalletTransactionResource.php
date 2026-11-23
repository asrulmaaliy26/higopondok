<?php

namespace App\Domains\Auth\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WalletTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user', function () {
                return [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'santri_name' => $this->user->santri_name,
                    'santri_room' => $this->user->santri_room,
                    'phone' => $this->user->phone,
                    'balance' => (float) $this->user->balance,
                ];
            }),
            'type' => $this->type,
            'amount' => (float) $this->amount,
            'balance_before' => (float) $this->balance_before,
            'balance_after' => (float) $this->balance_after,
            'status' => $this->status,
            'order_id' => $this->order_id,
            'proof_image' => $this->proof_image,
            'proof_image_url' => $this->proof_image ? asset('storage/' . $this->proof_image) : null,
            'description' => $this->description,
            'admin_notes' => $this->admin_notes,
            'approved_by' => $this->approved_by,
            'approver_name' => $this->whenLoaded('approver', fn () => $this->approver?->name),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'created_at_formatted' => $this->created_at?->timezone('Asia/Jakarta')->format('d M Y H:i'),
        ];
    }
}
