<?php

use App\Domains\DatabaseSync\Controllers\DatabaseSyncController;
use Illuminate\Support\Facades\Route;

// VPS Export Endpoint (Aman dengan token rahasia)
Route::match(['get', 'post'], '/db-sync/export', [DatabaseSyncController::class, 'export']);

// Local Pull & Status Endpoints (Hanya untuk Super Admin)
Route::middleware(['auth:sanctum', 'role:super_admin'])->group(function () {
    Route::post('/db-sync/pull', [DatabaseSyncController::class, 'pull']);
    Route::get('/db-sync/status', [DatabaseSyncController::class, 'status']);
});
