<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $password = Hash::make('password');

        // Create Admin
        $admin = User::firstOrCreate(
            ['email' => 'admin@higopondok.com'],
            ['name' => 'Administrator', 'password' => $password]
        );
        $admin->assignRole('admin');

        // Create Santri
        $santri = User::firstOrCreate(
            ['email' => 'santri@higopondok.com'],
            ['name' => 'Santri Dummy', 'password' => $password]
        );
        $santri->assignRole('user');

        // Create Kantin
        $kantin = User::firstOrCreate(
            ['email' => 'kantin@higopondok.com'],
            ['name' => 'Kantin Dummy', 'password' => $password]
        );
        $kantin->assignRole('kantin');

        // Seed Canteen for Kantin Dummy
        $canteen = Canteen::firstOrCreate(
            ['user_id' => $kantin->id],
            [
                'name' => 'Kantin Barokah Pusat',
                'description' => 'Menyediakan berbagai macam makanan dan minuman segar untuk para santri.',
                'status' => 'approved',
                'is_open' => true,
                'delivery_fee' => 5000,
                'admin_fee' => 2000,
                'sold_count' => 1250,
                'latitude' => -7.250445,
                'longitude' => 112.768845,
                'rating' => 4.8,
                'rating_count' => 340,
                'whatsapp_number' => '085784777797',
            ]
        );

        // Seed some Products
        if ($canteen->products()->count() === 0) {
            $canteen->products()->createMany([
                ['name' => 'Nasi Goreng Spesial', 'category' => 'Makanan Utama', 'hpp' => 1000, 'price' => 15000, 'discount_price' => 12000, 'stock' => 20, 'is_available' => true, 'sold_count' => 450, 'rating' => 4.9, 'rating_count' => 120],
                ['name' => 'Es Teh Manis', 'category' => 'Minuman', 'hpp' => 1000, 'price' => 4000, 'discount_price' => null, 'stock' => 50, 'is_available' => true, 'sold_count' => 800, 'rating' => 4.7, 'rating_count' => 220],
                ['name' => 'Ayam Geprek Level 5', 'category' => 'Makanan Utama', 'hpp' => 1000, 'price' => 18000, 'discount_price' => null, 'stock' => 0, 'is_available' => false, 'sold_count' => 0, 'rating' => 0, 'rating_count' => 0],
            ]);
        }

        // Seed Vouchers
        if (\App\Domains\Canteen\Voucher::count() === 0) {
            \App\Domains\Canteen\Voucher::create([
                'code' => 'SANTRIHEMAT',
                'discount_amount' => 5000,
                'min_purchase' => 20000,
                'valid_until' => now()->addDays(30),
            ]);
            \App\Domains\Canteen\Voucher::create([
                'code' => 'MAKANPUAS',
                'discount_amount' => 10000,
                'min_purchase' => 40000,
                'canteen_id' => $canteen->id,
                'valid_until' => now()->addDays(7),
            ]);
        }

        // Seed Banner
        if ($canteen->banners()->count() === 0) {
            $canteen->banners()->createMany([
                ['image_path' => 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80', 'title' => 'Diskon Nasi Goreng', 'status' => 'approved'],
                ['image_path' => 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80', 'title' => 'Promo Es Teh', 'status' => 'pending'],
            ]);
        }

        // Create Kurir
        $kurir = User::firstOrCreate(
            ['email' => 'kurir@higopondok.com'],
            ['name' => 'Kurir Dummy', 'password' => $password]
        );
        $kurir->assignRole('kurir');
        if ($canteen) {
            $kurir->assignedCanteens()->syncWithoutDetaching([$canteen->id]);
        }
    }
}
