<?php

use App\Domains\DatabaseSync\Controllers\DatabaseSyncController;
use Illuminate\Support\Facades\Route;

// VPS Export Endpoint (Aman dengan token rahasia)
Route::match(['get', 'post'], '/db-sync/export', [DatabaseSyncController::class, 'export']);

// Local Pull & Status Endpoints (Hanya untuk Admin login)
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::post('/db-sync/pull', [DatabaseSyncController::class, 'pull']);
    Route::get('/db-sync/status', [DatabaseSyncController::class, 'status']);
});
