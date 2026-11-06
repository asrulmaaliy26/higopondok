<?php

namespace App\Domains\Admin\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdminUpdateOrderNotesRequest extends FormRequest
{
    /**
     * Pastikan hanya super_admin atau admin yang berhak mengubah catatan
     */
    public function authorize(): bool
    {
        return $this->user() && ($this->user()->hasRole('admin') || $this->user()->hasRole('super_admin'));
    }

    /**
     * Aturan validasi pembaruan catatan pesanan & produk
     */
    public function rules(): array
    {
        return [
            'admin_notes' => 'nullable|string|max:2000',
            'custom_notes' => 'nullable|string|max:2000',
            'items' => 'nullable|array',
            'items.*.id' => 'required_with:items|integer',
            'items.*.notes' => 'nullable|string|max:1000',
            'sync_checkout' => 'nullable|boolean',
        ];
    }
}

