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
            if (!Schema::hasColumn('users', 'santri_name')) $table->string('santri_name')->nullable()->after('password');
            if (!Schema::hasColumn('users', 'santri_room')) $table->string('santri_room')->nullable()->after('santri_name');
            if (!Schema::hasColumn('users', 'santri_class')) $table->string('santri_class')->nullable()->after('santri_room');
            if (!Schema::hasColumn('users', 'santri_level')) $table->string('santri_level')->nullable()->after('santri_class');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('users', 'santri_name')) $cols[] = 'santri_name';
            if (Schema::hasColumn('users', 'santri_room')) $cols[] = 'santri_room';
            if (Schema::hasColumn('users', 'santri_class')) $cols[] = 'santri_class';
            if (Schema::hasColumn('users', 'santri_level')) $cols[] = 'santri_level';
            if (!empty($cols)) $table->dropColumn($cols);
        });
    }
};
