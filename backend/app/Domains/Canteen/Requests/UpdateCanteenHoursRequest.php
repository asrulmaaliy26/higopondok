<?php

namespace App\Domains\Canteen\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCanteenHoursRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() && ($this->user()->hasRole('admin') || $this->user()->hasRole('kantin'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'open_time' => ['required', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
            'close_time' => ['required', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
        ];
    }
}
