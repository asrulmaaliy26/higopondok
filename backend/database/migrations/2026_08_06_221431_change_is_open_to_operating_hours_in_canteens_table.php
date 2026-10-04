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
        Schema::table('canteens', function (Blueprint $table) {
            if (Schema::hasColumn('canteens', 'is_open')) {
                $table->dropColumn('is_open');
            }
            if (!Schema::hasColumn('canteens', 'open_time')) {
                $table->time('open_time')->default('09:00:00');
            }
            if (!Schema::hasColumn('canteens', 'close_time')) {
                $table->time('close_time')->default('17:00:00');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('canteens', function (Blueprint $table) {
            if (!Schema::hasColumn('canteens', 'is_open')) {
                $table->boolean('is_open')->default(false);
            }
            $cols = [];
            if (Schema::hasColumn('canteens', 'open_time')) $cols[] = 'open_time';
            if (Schema::hasColumn('canteens', 'close_time')) $cols[] = 'close_time';
            if (!empty($cols)) $table->dropColumn($cols);
        });
    }
};
