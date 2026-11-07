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
        Schema::create('admin_expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('expense_date')->index();
            $table->string('title');
            $table->string('category')->default('operasional')->index();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('payment_method')->default('cash')->index();
            $table->string('recipient')->nullable();
            $table->text('notes')->nullable();
            $table->string('proof_image')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_expenses');
    }
};

