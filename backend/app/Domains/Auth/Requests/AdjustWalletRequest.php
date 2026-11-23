<?php

namespace App\Domains\Auth\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdjustWalletRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && $user->hasAnyRole(['admin', 'super_admin']);
    }

    public function rules(): array
    {
        return [
            'user_id' => 'required|exists:users,id',
            'amount' => 'required|numeric|not_in:0|min:-10000000|max:10000000',
            'description' => 'required|string|max:255',
        ];
    }
}
