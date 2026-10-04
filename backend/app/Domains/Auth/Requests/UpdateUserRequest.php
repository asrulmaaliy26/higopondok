<?php

namespace App\Domains\Auth\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize()
    {
        return $this->user()->hasRole('admin');
    }

    public function rules()
    {
        // Mendapatkan ID user dari route (misal: PUT /admin/users/{user})
        $userId = $this->route('id');

        return [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $userId,
            'password' => 'nullable|string|min:8',
            'role' => 'sometimes|in:admin,user,kantin,kurir',
            'status' => 'sometimes|in:active,inactive,pending',
            'penalty_points' => 'sometimes|integer|min:0',
            'canteen_ids' => 'nullable|array',
            'canteen_ids.*' => 'exists:canteens,id',
        ];
    }
}
