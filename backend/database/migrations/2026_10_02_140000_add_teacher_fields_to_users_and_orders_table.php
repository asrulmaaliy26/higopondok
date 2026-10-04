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
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_teacher')->default(false)->after('is_working')->index();
            $table->string('niy')->nullable()->after('is_teacher')->index();
            $table->string('teacher_unit')->nullable()->after('niy')->index(); // RA, MI, SMP, MA, Kampus
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('order_for')->default('santri')->after('delivery_location')->index(); // guru, santri
            $table->boolean('is_priority')->default(false)->after('order_for')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['order_for', 'is_priority']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_teacher', 'niy', 'teacher_unit']);
        });
    }
};
