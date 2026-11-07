<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('google_drive_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable()->index();
            $table->text('client_id')->nullable();
            $table->text('client_secret')->nullable();
            $table->text('refresh_token')->nullable();
            $table->string('folder_id')->nullable();
            $table->string('folder_name')->nullable()->default('Higo Pondok Storage');
            $table->boolean('is_active')->default(false)->index();
            $table->string('status')->default('unknown')->index(); // connected, expired, full, error, unknown
            $table->text('status_message')->nullable();
            $table->unsignedBigInteger('storage_used')->default(0);
            $table->unsignedBigInteger('storage_limit')->default(16106127360); // 15 GB default
            $table->boolean('auto_switch_when_full')->default(true);
            $table->timestamp('last_checked_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Seed initial account from .env if configured
        $clientId = env('GOOGLE_DRIVE_CLIENT_ID');
        $clientSecret = env('GOOGLE_DRIVE_CLIENT_SECRET');
        $refreshToken = env('GOOGLE_DRIVE_REFRESH_TOKEN');
        $folderId = env('GOOGLE_DRIVE_SHARED_FOLDER_ID', '1ksLwc4S9MohrBTH4YISZOEhR5inWIbcH');

        if ($clientId || $refreshToken || $folderId) {
            DB::table('google_drive_accounts')->insert([
                'name' => 'Drive Utama Higo Pondok (Default)',
                'email' => env('MAIL_FROM_ADDRESS', 'higopondok@gmail.com'),
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'refresh_token' => $refreshToken,
                'folder_id' => $folderId,
                'folder_name' => 'Folder Utama Higo Pondok',
                'is_active' => true,
                'status' => 'unknown',
                'storage_used' => 0,
                'storage_limit' => 16106127360,
                'auto_switch_when_full' => true,
                'notes' => 'Akun penyimpanan bawaan dari konfigurasi awal server (.env)',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('google_drive_accounts');
    }
};

