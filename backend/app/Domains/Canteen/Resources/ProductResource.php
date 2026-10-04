<?php

namespace App\Domains\Canteen\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'description' => $this->description,
            'price' => (float) $this->price,
            'hpj' => (float) $this->price,
            'hpp' => (float) $this->hpp,
            'discount_price' => $this->discount_price,
            'stock' => $this->stock,
            'image' => $this->image,
            'is_available' => $this->is_available,
            'sold_count' => $this->sold_count,
            'rating' => $this->rating,
            'rating_count' => $this->rating_count,
            'variant_config' => $this->variant_config,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
