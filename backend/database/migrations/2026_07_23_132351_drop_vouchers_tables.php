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
        if (Schema::hasColumn('orders', 'voucher_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropForeign(['voucher_id']);
                $table->dropColumn('voucher_id');
            });
        }
        
        if (Schema::hasColumn('orders', 'discount_amount')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('discount_amount');
            });
        }

        Schema::dropIfExists('user_vouchers');
        Schema::dropIfExists('vouchers');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Re-creating these tables is beyond the scope of down() for a feature removal,
        // but typically you would define the Schema::create for vouchers here.
        // For simplicity, we leave it empty.
    }
};
