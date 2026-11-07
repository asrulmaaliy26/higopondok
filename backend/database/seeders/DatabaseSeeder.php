<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            UserSeeder::class,
            OrderSeeder::class,
            TodayOrdersSeeder::class,
            VoucherSeeder::class,
        ]);

        // Ensure default Google Drive storage account is seeded
        if (\Illuminate\Support\Facades\Schema::hasTable('google_drive_accounts') && \App\Domains\Admin\GoogleDriveAccount::count() === 0) {
            \App\Domains\Admin\GoogleDriveAccount::create([
                'name' => 'Drive Utama Higo Pondok (Default)',
                'email' => env('MAIL_FROM_ADDRESS', 'higopondok@gmail.com'),
                'client_id' => env('GOOGLE_DRIVE_CLIENT_ID'),
                'client_secret' => env('GOOGLE_DRIVE_CLIENT_SECRET'),
                'refresh_token' => env('GOOGLE_DRIVE_REFRESH_TOKEN'),
                'folder_id' => env('GOOGLE_DRIVE_SHARED_FOLDER_ID', '1ksLwc4S9MohrBTH4YISZOEhR5inWIbcH'),
                'folder_name' => 'Folder Utama Higo Pondok',
                'is_active' => true,
                'status' => 'unknown',
                'storage_used' => 0,
                'storage_limit' => 16106127360,
                'auto_switch_when_full' => true,
                'notes' => 'Akun penyimpanan bawaan sistem',
            ]);
        }

        // Seed initial sample AdminExpense if table exists and is empty
        if (\Illuminate\Support\Facades\Schema::hasTable('admin_expenses') && \App\Domains\Admin\AdminExpense::count() === 0) {
            $superAdminId = \App\Domains\Auth\User::first()?->id;
            \App\Domains\Admin\AdminExpense::create([
                'admin_id' => $superAdminId,
                'expense_date' => now('Asia/Jakarta')->toDateString(),
                'title' => 'Pembelian Kertas Thermal Printer 58mm (10 Roll)',
                'category' => 'perlengkapan',
                'amount' => 35000,
                'payment_method' => 'cash',
                'recipient' => 'Toko ATK Al-Barokah',
                'notes' => 'Stok kertas struk kurir & admin',
            ]);
        }
    }
}
