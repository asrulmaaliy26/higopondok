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
            if (!Schema::hasColumn('orders', 'admin_fee')) $table->decimal('admin_fee', 12, 2)->default(0)->after('total_price');
            if (!Schema::hasColumn('orders', 'delivery_fee')) $table->decimal('delivery_fee', 12, 2)->default(0)->after('admin_fee');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('orders', 'admin_fee')) $cols[] = 'admin_fee';
            if (Schema::hasColumn('orders', 'delivery_fee')) $cols[] = 'delivery_fee';
            if (!empty($cols)) $table->dropColumn($cols);
        });
    }
};
