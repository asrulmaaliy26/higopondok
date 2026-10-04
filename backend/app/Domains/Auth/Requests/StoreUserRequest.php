<?php

namespace App\Domains\Auth\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize()
    {
        return $this->user()->hasRole('admin');
    }

    public function rules()
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,user,kantin,kurir',
            'status' => 'required|in:active,inactive,pending',
            'canteen_ids' => 'nullable|array',
            'canteen_ids.*' => 'exists:canteens,id',
        ];
    }
}
