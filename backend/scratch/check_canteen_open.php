<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$now = now('Asia/Jakarta');
echo "Waktu sekarang (Asia/Jakarta): " . $now->format('Y-m-d H:i:s') . "\n";
echo "Global force closed: " . (Illuminate\Support\Facades\Cache::get('admin_global_canteen_force_closed', false) ? 'YES' : 'NO') . "\n";

foreach (App\Domains\Canteen\Canteen::all() as $c) {
    echo sprintf(
        "[%d] %-30s | Status: %-8s | isOpen: %-3s | forceClosed: %-3s | Jam: %s - %s\n",
        $c->id,
        $c->name,
        $c->status,
        $c->is_open ? 'YES' : 'NO',
        $c->is_force_closed ? 'YES' : 'NO',
        $c->open_time ?? 'NULL',
        $c->close_time ?? 'NULL'
    );
}
