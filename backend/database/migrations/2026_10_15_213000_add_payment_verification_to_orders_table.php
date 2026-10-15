<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_verified_by')->nullable()->after('payment_status'); // 'ai_gemini', 'manual_admin', 'manual_canteen'
            $table->string('payment_ref_number')->nullable()->index()->after('payment_verified_by'); // No ref transfer / QRIS
            $table->json('payment_ocr_data')->nullable()->after('payment_ref_number'); // Hasil pembacaan AI Vision
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['payment_ref_number']);
            $table->dropColumn(['payment_verified_by', 'payment_ref_number', 'payment_ocr_data']);
        });
    }
};
