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
        Schema::dropIfExists('ai_chat_logs');
        Schema::create('ai_chat_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('session_id')->nullable()->index();
            $table->text('raw_message');
            $table->text('normalized_message')->nullable();
            $table->string('model_used')->default('local_nlp')->index();
            $table->string('intent')->nullable()->index();
            $table->boolean('is_order_ready')->default(false)->index();
            $table->text('ai_response_text')->nullable();
            $table->json('extracted_data')->nullable();
            $table->boolean('is_converted')->default(false)->index();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('user_feedback')->nullable(); // helpful, not_helpful
            $table->text('feedback_notes')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_chat_logs');
    }
};
