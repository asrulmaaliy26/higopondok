<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'recipient_santri_name')) {
                $table->string('recipient_santri_name')->nullable()->after('user_id')->index();
            }
            if (!Schema::hasColumn('orders', 'recipient_santri_room')) {
                $table->string('recipient_santri_room')->nullable()->after('recipient_santri_name');
            }
            if (!Schema::hasColumn('orders', 'recipient_santri_class')) {
                $table->string('recipient_santri_class')->nullable()->after('recipient_santri_room');
            }
            if (!Schema::hasColumn('orders', 'recipient_santri_level')) {
                $table->string('recipient_santri_level')->nullable()->after('recipient_santri_class');
            }
            if (!Schema::hasColumn('orders', 'recipient_phone')) {
                $table->string('recipient_phone')->nullable()->after('recipient_santri_level');
            }
        });

        // Backfill data dari users untuk pesanan yang sudah ada (khusus MySQL)
        if (DB::getDriverName() === 'mysql') {
            DB::statement("
                UPDATE orders
                JOIN users ON orders.user_id = users.id
                SET orders.recipient_santri_name = CASE 
                        WHEN users.is_teacher = 1 THEN users.name 
                        WHEN users.santri_name IS NOT NULL AND users.santri_name != '' THEN users.santri_name 
                        ELSE users.name 
                    END,
                    orders.recipient_santri_room = CASE
                        WHEN users.is_teacher = 1 THEN users.teacher_unit
                        ELSE users.santri_room
                    END,
                    orders.recipient_santri_class = users.santri_class,
                    orders.recipient_santri_level = users.santri_level,
                    orders.recipient_phone = users.phone
                WHERE orders.recipient_santri_name IS NULL
            ");
        }

        // Pulihkan pesanan #2678 & #2679 spesifik untuk Zetta Arzagnafia
        DB::table('orders')
            ->whereIn('id', [2678, 2679])
            ->update([
                'recipient_santri_name' => 'ZETTA ARZAGNAFIA',
                'recipient_santri_room' => 'asmah'
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['recipient_santri_name']);
            $table->dropColumn([
                'recipient_santri_name',
                'recipient_santri_room',
                'recipient_santri_class',
                'recipient_santri_level',
                'recipient_phone',
            ]);
        });
    }
};
