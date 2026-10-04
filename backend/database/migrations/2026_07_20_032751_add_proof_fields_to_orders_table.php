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
        // Migrate existing strings to JSON arrays
        \Illuminate\Support\Facades\DB::table('orders')->whereNotNull('proof_of_delivery')->get()->each(function ($order) {
            // Check if it's not already JSON
            if (!str_starts_with($order->proof_of_delivery, '[')) {
                $json = json_encode([$order->proof_of_delivery]);
                \Illuminate\Support\Facades\DB::table('orders')->where('id', $order->id)->update(['proof_of_delivery' => $json]);
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->json('proof_of_delivery')->nullable()->change();
            if (!Schema::hasColumn('orders', 'proof_of_payment')) {
                $table->json('proof_of_payment')->nullable()->after('proof_of_delivery');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('proof_of_delivery')->nullable()->change();
            if (Schema::hasColumn('orders', 'proof_of_payment')) {
                $table->dropColumn('proof_of_payment');
            }
        });
    }
};
