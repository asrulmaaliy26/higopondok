<?php

namespace App\Domains\Canteen\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Domains\Canteen\Order;

class UpdateUserOrderNotesRequest extends FormRequest
{
    /**
     * Otorisasi: Pemilik pesanan (user) atau admin / super admin
     */
    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user) {
            return false;
        }

        if ($user->hasRole('admin') || $user->hasRole('super_admin')) {
            return true;
        }

        $id = $this->route('id') ?: $this->route('checkoutId');
        if (!$id) {
            return true;
        }

        $query = Order::query();
        if (is_numeric($id)) {
            $query->where('id', $id);
        } else {
            $query->where('checkout_id', $id);
        }

        $order = $query->first();
        if (!$order) {
            return true; // Diteruskan ke controller untuk 404
        }

        return (int) $order->user_id === (int) $user->id;
    }

    /**
     * Aturan validasi
     */
    public function rules(): array
    {
        return [
            'order_notes' => 'nullable|string|max:2000',
            'sync_checkout' => 'nullable|boolean',
        ];
    }
}

