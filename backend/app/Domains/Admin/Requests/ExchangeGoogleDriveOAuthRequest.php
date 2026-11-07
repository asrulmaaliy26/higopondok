<?php

namespace App\Domains\Admin\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExchangeGoogleDriveOAuthRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->hasRole('super_admin');
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string'],
            'redirect_uri' => ['nullable', 'string'],
            'account_id' => ['nullable', 'integer'],
            'name' => ['nullable', 'string', 'max:255'],
            'folder_id' => ['nullable', 'string', 'max:500'],
            'set_active' => ['nullable', 'boolean'],
        ];
    }
}

