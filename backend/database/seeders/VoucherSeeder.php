<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\Canteen;
use App\Domains\Auth\User;

class VoucherSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::role('admin')->first() ?? User::first();
        $canteen = Canteen::first();

        // 1. Voucher Gratis Biaya Admin dari Admin (Semua Santri)
        Voucher::firstOrCreate(
            ['code' => 'GRATISADMIN'],
            [
                'title' => 'Bebas Biaya Layanan Admin',
                'description' => 'Potongan biaya admin Rp 2.000 untuk setiap pesanan santri Al-Mannan.',
                'discount_type' => 'admin_fee',
                'discount_amount' => 2000,
                'min_purchase' => 0,
                'canteen_id' => null, // Berlaku untuk semua kantin
                'created_by_user_id' => $admin?->id,
                'target_type' => 'all',
                'target_user_ids' => null,
                'quota' => 500,
                'claimed_count' => 0,
                'valid_until' => now()->addMonths(3),
                'is_active' => true,
            ]
        );

        // 2. Voucher Hemat Jajan dari Kantin
        if ($canteen) {
            Voucher::firstOrCreate(
                ['code' => 'HEMATJAJAN'],
                [
                    'title' => 'Diskon Jajan ' . $canteen->name,
                    'description' => 'Potongan harga belanja produk Rp 3.000 minimal belanja Rp 10.000.',
                    'discount_type' => 'product_discount',
                    'discount_amount' => 3000,
                    'min_purchase' => 10000,
                    'canteen_id' => $canteen->id,
                    'created_by_user_id' => $canteen->user_id,
                    'target_type' => 'all',
                    'target_user_ids' => null,
                    'quota' => 100,
                    'claimed_count' => 0,
                    'valid_until' => now()->addMonths(2),
                    'is_active' => true,
                ]
            );
        }
    }
}
