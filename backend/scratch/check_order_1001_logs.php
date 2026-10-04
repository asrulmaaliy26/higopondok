<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Admin\PaymentLog;
use App\Domains\Admin\ActivityLog;

$logs = PaymentLog::where('order_id', 1001)->get();
echo "PaymentLogs:\n" . json_encode($logs, JSON_PRETTY_PRINT) . "\n\n";

$acts = ActivityLog::where('model_id', 1001)->get();
echo "ActivityLogs:\n" . json_encode($acts, JSON_PRETTY_PRINT) . "\n";
