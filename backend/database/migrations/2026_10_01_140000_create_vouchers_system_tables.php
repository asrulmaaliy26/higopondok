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
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('discount_type')->default('admin_fee')->index(); // 'admin_fee', 'delivery_fee', 'product_discount'
            $table->decimal('discount_amount', 10, 2);
            $table->decimal('min_purchase', 10, 2)->default(0);
            $table->foreignId('canteen_id')->nullable()->constrained('canteens')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('target_type')->default('all')->index(); // 'all', 'specific'
            $table->json('target_user_ids')->nullable();
            $table->integer('quota')->nullable();
            $table->integer('claimed_count')->default(0);
            $table->dateTime('valid_until')->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('user_vouchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->dateTime('claimed_at');
            $table->boolean('is_used')->default(false)->index();
            $table->dateTime('used_at')->nullable();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'voucher_id']);
        });

        if (!Schema::hasColumn('orders', 'voucher_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->foreignId('voucher_id')->nullable()->constrained()->nullOnDelete();
                $table->decimal('voucher_discount', 10, 2)->default(0);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('orders', 'voucher_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropForeign(['voucher_id']);
                $table->dropColumn(['voucher_id', 'voucher_discount']);
            });
        }
        Schema::dropIfExists('user_vouchers');
        Schema::dropIfExists('vouchers');
    }
};
