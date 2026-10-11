<?php

use Illuminate\Support\Facades\Route;
use App\Domains\Auth\Controllers\AuthController;
use App\Domains\Auth\Controllers\RegisterController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/google', [AuthController::class, 'loginWithGoogle']);
Route::post('/register', [RegisterController::class, 'registerUser']);
Route::post('/register/canteen', [RegisterController::class, 'registerCanteen']);
Route::post('/register/driver', [RegisterController::class, 'registerDriver']);

use App\Domains\Auth\Controllers\AdminController;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::match(['put', 'post'], '/me', [AuthController::class, 'updateProfile']);
    Route::put('/me/working-status', [AuthController::class, 'toggleWorkingStatus']);
    
    // User & Store destruction management strictly for super_admin
    Route::middleware('role:super_admin')->group(function () {
        Route::get('/admin/users', [\App\Domains\Auth\Controllers\UserController::class, 'index']);
        Route::post('/admin/users', [\App\Domains\Auth\Controllers\UserController::class, 'store']);
        Route::put('/admin/users/{id}', [\App\Domains\Auth\Controllers\UserController::class, 'update']);
        Route::delete('/admin/users/{id}', [\App\Domains\Auth\Controllers\UserController::class, 'destroy']);
        Route::delete('/admin/canteens/{id}', [AdminController::class, 'destroyCanteen']);
    });

    // Admin & Super Admin operational routes
    Route::middleware('role:admin|super_admin')->group(function () {
        Route::put('/admin/users/{id}/set-teacher', [AdminController::class, 'setTeacherStatus']);
        Route::get('/admin/canteens', [AdminController::class, 'allCanteens']);
        Route::get('/admin/canteens/status', [AdminController::class, 'globalStatus']);
        Route::post('/admin/canteens/bulk-close', [AdminController::class, 'bulkClose']);
        Route::post('/admin/canteens/bulk-open', [AdminController::class, 'bulkOpen']);
        Route::match(['put', 'post'], '/admin/canteens/bulk-hours', [AdminController::class, 'bulkUpdateHours']);
        Route::put('/admin/canteens/{id}/toggle-direct-close', [AdminController::class, 'toggleDirectClose']);
        Route::get('/admin/stats', [AdminController::class, 'dashboardStats']);
        Route::put('/admin/canteens/{id}/fees', [AdminController::class, 'updateFees']);
        Route::put('/admin/canteens/{id}/hours', [AdminController::class, 'updateHours']);
        Route::post('/admin/canteens/{id}/pay-debt', [AdminController::class, 'payAdminDebt']);
        Route::post('/admin/canteens/{id}/withdraw', [AdminController::class, 'processWithdrawal']);
        
        Route::get('/admin/canteens/pending', [AdminController::class, 'pendingCanteens']);
        Route::post('/admin/canteens/{id}/approve', [AdminController::class, 'approveCanteen']);
        Route::post('/admin/canteens/{id}/reject', [AdminController::class, 'rejectCanteen']);
        
        Route::get('/admin/drivers/pending', [AdminController::class, 'pendingDrivers']);
        Route::post('/admin/drivers/{id}/approve', [AdminController::class, 'approveDriver']);
        Route::post('/admin/drivers/{id}/reject', [AdminController::class, 'rejectDriver']);

        // Impersonate Route
        Route::post('/admin/impersonate/{id}', [AdminController::class, 'impersonateUser']);

        // Admin Orders & Recap & Recycle Bin
        Route::get('/admin/orders', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'index']);
        Route::get('/admin/orders/recap', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'recap']);
        Route::put('/admin/orders/{id}/cancel', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'cancel']);
        Route::put('/admin/orders/{id}/status', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'updateStatus']);
        Route::post('/admin/orders/{id}/payment-proof', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'uploadPaymentProof']);
        Route::delete('/admin/orders/{id}/proof', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'deleteProof']);
        Route::get('/admin/orders/trash', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'trash']);
        Route::delete('/admin/orders/{id}', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'destroy']);
        Route::post('/admin/orders/{id}/restore', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'restore']);
        Route::delete('/admin/orders/{id}/force', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'forceDelete']);
        Route::post('/admin/orders/trash/empty', [\App\Domains\Admin\Controllers\AdminOrderController::class, 'emptyTrash']);

        // Logs
        Route::get('/admin/logs/activity', [AdminController::class, 'activityLogs']);
        Route::get('/admin/logs/payment', [AdminController::class, 'paymentLogs']);

        // Admin Vouchers
        Route::get('/admin/vouchers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'allVouchers']);
        Route::get('/admin/vouchers/{id}/claimers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'claimers']);
        Route::post('/admin/vouchers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'store']);
        Route::put('/admin/vouchers/{id}/status', [\App\Domains\Canteen\Controllers\VoucherController::class, 'toggleStatus']);
        Route::delete('/admin/vouchers/{id}', [\App\Domains\Canteen\Controllers\VoucherController::class, 'destroy']);
        Route::get('/admin/vouchers/santri-options', [\App\Domains\Canteen\Controllers\VoucherController::class, 'santriOptions']);
    });
});
