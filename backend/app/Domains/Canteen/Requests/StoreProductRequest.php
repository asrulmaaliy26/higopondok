<?php

namespace App\Domains\Canteen\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('hpj') && !$this->has('price')) {
            $this->merge(['price' => $this->hpj]);
        } elseif ($this->has('price') && !$this->has('hpj')) {
            $this->merge(['hpj' => $this->price]);
        }

        $price = $this->price ?? $this->hpj;
        $hpp = $this->hpp;

        if (($hpp === null || $hpp === '') && $price !== null && $price !== '') {
            $calcHpp = (float)$price > 1000 ? ((float)$price - 1000) : (float)$price;
            $this->merge(['hpp' => $calcHpp]);
        } elseif (($price === null || $price === '') && $hpp !== null && $hpp !== '') {
            $calcPrice = (float)$hpp + 1000;
            $this->merge(['price' => $calcPrice, 'hpj' => $calcPrice]);
        }

        if ($this->has('variant_config') && is_string($this->variant_config)) {
            $decoded = json_decode($this->variant_config, true);
            if (is_array($decoded)) {
                $this->merge(['variant_config' => $decoded]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string',
            'category' => 'nullable|string',
            'description' => 'nullable|string',
            'variant_config' => 'nullable|array',
            'price' => 'required_without:hpj|numeric|min:0',
            'hpj' => 'nullable|numeric|min:0',
            'hpp' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'is_available' => 'boolean',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ];
    }
}
