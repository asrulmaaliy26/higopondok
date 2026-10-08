<?php

use Illuminate\Support\Facades\Route;
use App\Domains\Canteen\Controllers\CanteenController;
use App\Domains\Canteen\Controllers\ProductController;

// Public routes (for Santri to see canteens and their products)
Route::get('/canteens', [CanteenController::class, 'index']);
Route::get('/canteens/{id}', [CanteenController::class, 'show']);

Route::middleware(['auth:sanctum', 'impersonate'])->group(function () {
    // Routes for kantin, admin & super_admin role
    Route::middleware('role:kantin|admin|super_admin')->group(function () {

        Route::get('/my-canteens', [CanteenController::class, 'myCanteens']);
        Route::get('/my-canteens/analytics', [\App\Domains\Canteen\Controllers\CanteenAnalyticsController::class, 'globalStats']);
        Route::post('/my-canteens', [CanteenController::class, 'storeMyCanteen']);
        Route::get('/my-canteen', [CanteenController::class, 'myCanteen']);
        Route::get('/my-canteen/stats', [CanteenController::class, 'dashboardStats']);
        Route::get('/my-canteen/ledgers', [CanteenController::class, 'balanceLedgers']);
        Route::match(['put', 'post'], '/my-canteen', [CanteenController::class, 'updateMyCanteen']);
        
        Route::apiResource('my-products', ProductController::class)->except(['show']);

        // Banner & Voucher Management
        Route::post('/canteen/banners', [\App\Domains\Canteen\Controllers\CanteenBannerController::class, 'store']);
        Route::put('/canteen/banners/{id}', [\App\Domains\Canteen\Controllers\CanteenBannerController::class, 'update']);
        Route::put('/canteen/banners/{id}/status', [\App\Domains\Canteen\Controllers\CanteenBannerController::class, 'toggleStatus']);
        Route::delete('/canteen/banners/{id}', [\App\Domains\Canteen\Controllers\CanteenBannerController::class, 'destroy']);

        // Voucher routes for Canteen & Admin
        Route::get('/canteen/vouchers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'canteenVouchers']);
        Route::get('/canteen/vouchers/{id}/claimers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'claimers']);
        Route::post('/canteen/vouchers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'store']);
        Route::put('/canteen/vouchers/{id}/status', [\App\Domains\Canteen\Controllers\VoucherController::class, 'toggleStatus']);
        Route::delete('/canteen/vouchers/{id}', [\App\Domains\Canteen\Controllers\VoucherController::class, 'destroy']);
        Route::get('/vouchers/santri-options', [\App\Domains\Canteen\Controllers\VoucherController::class, 'santriOptions']);

        // Order Management for Canteen & Admin
        Route::get('/canteen/orders', [\App\Domains\Canteen\Controllers\OrderController::class, 'canteenOrders']);
        Route::get('/canteen/orders/recap', [\App\Domains\Canteen\Controllers\OrderController::class, 'recap']);
        Route::put('/canteen/orders/{id}/payment', [\App\Domains\Canteen\Controllers\OrderController::class, 'updatePaymentStatus']);
        Route::match(['put', 'post'], '/canteen/orders/batch-status', [\App\Domains\Canteen\Controllers\OrderController::class, 'batchUpdateOrderStatus']);
        Route::put('/canteen/orders/{id}/status', [\App\Domains\Canteen\Controllers\OrderController::class, 'updateOrderStatus']);
        Route::put('/canteen/orders/{id}/complete', [\App\Domains\Canteen\Controllers\OrderController::class, 'completeByCanteen']);
        Route::post('/canteen/orders/{id}/upload-receipt', [\App\Domains\Canteen\Controllers\OrderController::class, 'uploadPurchaseProof']);
        Route::post('/canteen/orders/{id}/payment-proof', [\App\Domains\Canteen\Controllers\OrderController::class, 'uploadPaymentProofByCanteen']);
        Route::delete('/canteen/orders/{id}/proof', [\App\Domains\Canteen\Controllers\OrderController::class, 'deleteProofPhoto']);
        Route::put('/canteen/orders/{id}/courier', [\App\Domains\Canteen\Controllers\OrderController::class, 'assignCourier']);
        Route::put('/canteen/orders/{id}/cancel', [\App\Domains\Canteen\Controllers\OrderController::class, 'cancelOrder']);
        
        Route::get('/canteen/santri-list', [\App\Domains\Canteen\Controllers\OrderController::class, 'getSantriList']);
        Route::post('/canteen/orders/manual', [\App\Domains\Canteen\Controllers\OrderController::class, 'createOrderByCanteen']);
        Route::put('/canteen/orders/{id}/custom-price', [\App\Domains\Canteen\Controllers\OrderController::class, 'setCustomOrderPrice']);
        
        Route::get('/couriers', [\App\Domains\Canteen\Controllers\OrderController::class, 'getCouriers']);
    });
    
    // Courier routes
    Route::middleware('role:kurir')->group(function () {
        Route::get('/courier/orders', [\App\Domains\Canteen\Controllers\OrderController::class, 'courierOrders']);
        Route::post('/courier/orders/{id}/take', [\App\Domains\Canteen\Controllers\OrderController::class, 'takeOrder']);
        Route::post('/courier/orders/{id}/complete', [\App\Domains\Canteen\Controllers\OrderController::class, 'completeOrder']);
        Route::post('/courier/orders/{id}/upload-receipt', [\App\Domains\Canteen\Controllers\OrderController::class, 'uploadPurchaseProof']);
        Route::post('/courier/orders/{id}/upload-delivery', [\App\Domains\Canteen\Controllers\OrderController::class, 'uploadDeliveryProof']);
        Route::delete('/courier/orders/{id}/proof', [\App\Domains\Canteen\Controllers\OrderController::class, 'deleteProofPhoto']);
        Route::put('/courier/orders/{id}/cancel', [\App\Domains\Canteen\Controllers\OrderController::class, 'courierCancelOrder']);
    });

    // User routes
    Route::post('/orders', [\App\Domains\Canteen\Controllers\OrderController::class, 'store']);
    Route::post('/orders/batch', [\App\Domains\Canteen\Controllers\OrderController::class, 'batchStore']);
    Route::get('/orders', [\App\Domains\Canteen\Controllers\OrderController::class, 'userOrders']);
    Route::put('/orders/{id}/cancel', [\App\Domains\Canteen\Controllers\OrderController::class, 'userCancelOrder']);
    Route::post('/orders/{id}/payment-proof', [\App\Domains\Canteen\Controllers\OrderController::class, 'uploadPaymentProof']);
    Route::post('/orders/checkout/{checkoutId}/payment-proof', [\App\Domains\Canteen\Controllers\OrderController::class, 'uploadPaymentProofByCheckout']);

    // User Voucher routes
    Route::get('/my-vouchers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'myVouchers']);
    Route::post('/vouchers/{id}/claim', [\App\Domains\Canteen\Controllers\VoucherController::class, 'claim']);
});

Route::get('/vouchers', [\App\Domains\Canteen\Controllers\VoucherController::class, 'index']);
Route::get('/banners', [\App\Domains\Canteen\Controllers\CanteenBannerController::class, 'index']);
Route::get('/pricing-config', [\App\Domains\Canteen\Controllers\OrderController::class, 'pricingConfig']);
