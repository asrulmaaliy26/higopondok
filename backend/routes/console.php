<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Bersihkan token Sanctum yang sudah kedaluwarsa secara otomatis setiap hari
Schedule::command('sanctum:prune-expired --hours=48')->daily();

// Command Sinkronisasi Database VPS
Artisan::command('db:pull-vps {--url= : URL endpoint VPS} {--secret= : Secret key}', function (\App\Domains\DatabaseSync\Services\DatabaseSyncService $service) {
    $cmd = new \App\Domains\DatabaseSync\Commands\DbPullVpsCommand();
    $cmd->setOutput($this->output);
    $cmd->setInput($this->input);
    return $cmd->handle($service);
})->purpose('Tarik dan sinkronkan database lokal secara otomatis dari VPS');

