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
            if (!Schema::hasColumn('orders', 'is_courier_paid_by_canteen')) {
                $table->boolean('is_courier_paid_by_canteen')->default(false)->after('courier_id');
            }
            if (!Schema::hasColumn('orders', 'proof_courier_paid')) {
                $table->string('proof_courier_paid')->nullable()->after('is_courier_paid_by_canteen');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('orders', 'is_courier_paid_by_canteen')) $cols[] = 'is_courier_paid_by_canteen';
            if (Schema::hasColumn('orders', 'proof_courier_paid')) $cols[] = 'proof_courier_paid';
            if (!empty($cols)) $table->dropColumn($cols);
        });
    }
};
