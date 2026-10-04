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
        if (!Schema::hasTable('canteen_couriers')) {
            Schema::create('canteen_couriers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('canteen_id')->constrained('canteens')->cascadeOnDelete();
                $table->foreignId('courier_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['canteen_id', 'courier_id']);
                $table->index('canteen_id');
                $table->index('courier_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('canteen_couriers');
    }
};
