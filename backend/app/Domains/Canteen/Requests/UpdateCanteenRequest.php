<?php

namespace App\Domains\Canteen\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCanteenRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Auth is handled by middleware
    }

    protected function prepareForValidation()
    {
        if ($this->has('closed_days') && is_string($this->closed_days)) {
            $decoded = json_decode($this->closed_days, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $this->merge(['closed_days' => $decoded]);
            }
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'open_time' => 'nullable|string',
            'close_time' => 'nullable|string',
            'closed_days' => 'nullable|array',
            'closed_days.*' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048', // Maks 2MB
            'whatsapp_number' => 'nullable|string|max:20',
            'delivery_fee' => 'nullable|numeric|min:0',
            'delivery_rates' => 'nullable|array',
            'delivery_rates.*' => 'nullable|numeric|min:0',
            'is_open' => 'nullable',
        ];
    }
}
