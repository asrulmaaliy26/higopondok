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
            if (!Schema::hasColumn('users', 'santri_dietary_notes')) {
                $table->text('santri_dietary_notes')->nullable()->after('santri_level');
            }
            if (!Schema::hasColumn('users', 'santri_daily_limit')) {
                $table->decimal('santri_daily_limit', 12, 2)->default(0)->after('santri_dietary_notes');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'santri_daily_limit')) {
                $table->dropColumn('santri_daily_limit');
            }
            if (Schema::hasColumn('users', 'santri_dietary_notes')) {
                $table->dropColumn('santri_dietary_notes');
            }
        });
    }
};
