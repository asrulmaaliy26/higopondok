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
            if (!Schema::hasColumn('canteens', 'category')) {
                $table->enum('category', ['kauman', 'kota'])->default('kauman')->after('name');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('canteens', function (Blueprint $table) {
            if (Schema::hasColumn('canteens', 'category')) {
                $table->dropColumn('category');
            }
        });
    }
};
