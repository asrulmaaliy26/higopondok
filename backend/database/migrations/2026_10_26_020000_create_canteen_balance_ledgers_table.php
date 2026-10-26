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
        if (!Schema::hasTable('canteen_balance_ledgers')) {
            Schema::create('canteen_balance_ledgers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('canteen_id')->constrained()->cascadeOnDelete();
                $table->foreignId('order_id')->nullable()->constrained()->cascadeOnDelete();
                $table->string('type', 20)->index(); // 'in' atau 'out'
                $table->decimal('amount', 12, 2);
                $table->decimal('balance_before', 12, 2)->default(0);
                $table->decimal('balance_after', 12, 2)->default(0);
                $table->string('description', 255)->nullable();
                $table->timestamps();

                $table->index(['canteen_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('canteen_balance_ledgers');
    }
};
