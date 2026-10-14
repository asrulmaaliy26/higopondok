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
            if (!Schema::hasColumn('canteens', 'closed_days')) {
                $table->json('closed_days')->nullable()->after('close_time');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('canteens', function (Blueprint $table) {
            if (Schema::hasColumn('canteens', 'closed_days')) {
                $table->dropColumn('closed_days');
            }
        });
    }
};
