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
        if (!Schema::hasTable('wallet_transactions')) {
            Schema::create('wallet_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('type')->index(); // topup, payment, refund, adjustment
                $table->decimal('amount', 12, 2);
                $table->decimal('balance_before', 12, 2)->default(0);
                $table->decimal('balance_after', 12, 2)->default(0);
                $table->string('status')->default('completed')->index(); // pending, completed, rejected
                $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
                $table->string('proof_image')->nullable();
                $table->string('description');
                $table->text('admin_notes')->nullable();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
