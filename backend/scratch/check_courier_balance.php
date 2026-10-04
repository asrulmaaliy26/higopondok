<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Domains\Auth\User;

$couriers = User::whereHas('roles', fn($q) => $q->where('name', 'kurir'))->get();
foreach ($couriers as $c) {
    echo "Courier ID: {$c->id} | Name: {$c->name} | Balance: {$c->balance}\n";
}
