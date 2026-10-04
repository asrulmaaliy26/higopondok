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
            if (!Schema::hasColumn('orders', 'is_custom')) $table->boolean('is_custom')->default(false)->after('canteen_id');
            if (!Schema::hasColumn('orders', 'custom_notes')) $table->text('custom_notes')->nullable()->after('is_custom');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('orders', 'is_custom')) $cols[] = 'is_custom';
            if (Schema::hasColumn('orders', 'custom_notes')) $cols[] = 'custom_notes';
            if (!empty($cols)) $table->dropColumn($cols);
        });
    }
};
