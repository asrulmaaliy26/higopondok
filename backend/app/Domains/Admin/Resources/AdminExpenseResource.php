<?php

namespace App\Domains\Admin\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Domains\Admin\AdminExpense;

class AdminExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $categories = AdminExpense::getCategories();
        $proofUrl = null;
        if ($this->proof_image) {
            if (str_starts_with($this->proof_image, 'http')) {
                $proofUrl = $this->proof_image;
            } else {
                $proofUrl = url('/api/media/' . ltrim($this->proof_image, '/'));
            }
        }

        return [
            'id' => $this->id,
            'admin_id' => $this->admin_id,
            'admin_name' => $this->whenLoaded('admin', fn() => $this->admin?->name ?? 'Admin', 'Admin'),
            'expense_date' => $this->expense_date ? $this->expense_date->format('Y-m-d') : null,
            'title' => $this->title,
            'category' => $this->category,
            'category_label' => $categories[$this->category] ?? ucfirst(str_replace('_', ' ', $this->category)),
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method ?? 'cash',
            'recipient' => $this->recipient,
            'notes' => $this->notes,
            'proof_image' => $this->proof_image,
            'proof_url' => $proofUrl,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

