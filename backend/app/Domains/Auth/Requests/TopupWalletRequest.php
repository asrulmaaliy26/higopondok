<?php

namespace App\Domains\Auth\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TopupWalletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'amount' => 'required|numeric|min:5000|max:10000000',
            'proof_image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
            'notes' => 'nullable|string|max:500',
        ];
    }
}
