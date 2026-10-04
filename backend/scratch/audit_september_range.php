<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
$app = require_once 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domains\Canteen\Order;
use Carbon\Carbon;

$csvFile = 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/Laporan Transaksi GoPay 20260901 - 20260911.csv';

if (!file_exists($csvFile)) {
    die("File CSV tidak ditemukan: $csvFile\n");
}

$rows = array_map('str_getcsv', file($csvFile));
$header = array_shift($rows);

// Parse CSV and group by date (Y-m-d)
$gopayByDate = [];
$totalGopayTrx = 0;
$totalGopayNominal = 0;

$monthMap = [
    'Jan' => '01', 'Feb' => '02', 'Mar' => '03', 'Apr' => '04',
    'Mei' => '05', 'May' => '05', 'Jun' => '06', 'Jul' => '07',
    'Agu' => '08', 'Aug' => '08', 'Sep' => '09', 'Okt' => '10',
    'Oct' => '10', 'Nov' => '11', 'Des' => '12', 'Dec' => '12'
];

foreach ($rows as $r) {
    if (empty($r) || count($r) < 7) continue;
    $timeStr = $r[1]; // misal "10 Sep 2026 - 16:28:09"
    $status = $r[3];
    $amount = (float) $r[6];
    $ref = $r[5];

    // Ekstrak tanggal
    // Format: "10 Sep 2026"
    if (preg_match('/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/', $timeStr, $m)) {
        $day = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $mon = $monthMap[$m[2]] ?? '09';
        $year = $m[3];
        $dateKey = "{$year}-{$mon}-{$day}";
    } else {
        $dateKey = 'unknown';
    }

    if (!isset($gopayByDate[$dateKey])) {
        $gopayByDate[$dateKey] = [
            'count' => 0,
            'total' => 0,
            'amounts' => [],
            'items' => []
        ];
    }

    $gopayByDate[$dateKey]['count']++;
    $gopayByDate[$dateKey]['total'] += $amount;
    $gopayByDate[$dateKey]['amounts'][] = (int)$amount;
    $gopayByDate[$dateKey]['items'][] = [
        'ref' => $ref,
        'amount' => $amount,
        'time' => $timeStr,
        'status' => $status
    ];

    $totalGopayTrx++;
    $totalGopayNominal += $amount;
}

// Ambil data Database untuk 2026-09-01 s/d 2026-09-11
$startDate = '2026-09-01';
$endDate = '2026-09-11';

$dbOrders = Order::forRecap()
    ->whereBetween('created_at', [
        Carbon::parse($startDate)->startOfDay(),
        Carbon::parse($endDate)->endOfDay()
    ])
    ->with(['user', 'canteen'])
    ->get();

$dbByDate = [];
$totalDbTrx = 0;
$totalDbNominal = 0;

foreach ($dbOrders as $o) {
    $dateKey = $o->created_at->format('Y-m-d');
    $amount = (float) $o->total_price;

    if (!isset($dbByDate[$dateKey])) {
        $dbByDate[$dateKey] = [
            'count' => 0,
            'total' => 0,
            'amounts' => [],
            'orders' => []
        ];
    }

    $dbByDate[$dateKey]['count']++;
    $dbByDate[$dateKey]['total'] += $amount;
    $dbByDate[$dateKey]['amounts'][] = (int)$amount;
    $dbByDate[$dateKey]['orders'][] = $o;

    $totalDbTrx++;
    $totalDbNominal += $amount;
}

// Gabungkan semua tanggal unik
$allDates = array_unique(array_merge(array_keys($gopayByDate), array_keys($dbByDate)));
sort($allDates);

echo "=== AUDIT REKONSILIASI GOPAY VS DATABASE (1 - 11 SEPTEMBER 2026) ===\n\n";

echo "📊 RINGKASAN KESELURUHAN (1 - 11 SEPTEMBER 2026):\n";
echo "  • Total Transaksi GoPay CSV : " . number_format($totalGopayTrx, 0, ',', '.') . " transaksi\n";
echo "  • Total Pesanan di Database  : " . number_format($totalDbTrx, 0, ',', '.') . " pesanan\n";
echo "  • Total Uang Masuk di GoPay   : Rp " . number_format($totalGopayNominal, 0, ',', '.') . "\n";
echo "  • Total Tagihan di Database  : Rp " . number_format($totalDbNominal, 0, ',', '.') . "\n";
echo "  • Selisih (GoPay - Database)  : Rp " . number_format($totalGopayNominal - $totalDbNominal, 0, ',', '.') . "\n\n";

echo "📅 TABEL PERBANDINGAN HARIAN:\n";
echo sprintf("%-12s | %-15s | %-15s | %-20s | %-20s | %-12s\n", 
    "Tanggal", "Jml GoPay", "Jml DB", "Total GoPay (Rp)", "Total DB (Rp)", "Selisih (Rp)"
);
echo str_repeat("-", 105) . "\n";

$mismatches = [];

foreach ($allDates as $dt) {
    $gCount = $gopayByDate[$dt]['count'] ?? 0;
    $dCount = $dbByDate[$dt]['count'] ?? 0;
    $gTotal = $gopayByDate[$dt]['total'] ?? 0;
    $dTotal = $dbByDate[$dt]['total'] ?? 0;
    $diff = $gTotal - $dTotal;

    $statusIcon = ($gCount === $dCount && $diff == 0) ? "✅ PAS" : "⚠️ BEDA";

    echo sprintf("%-12s | %-15d | %-15d | Rp %-17s | Rp %-17s | Rp %-12s %s\n",
        $dt, $gCount, $dCount,
        number_format($gTotal, 0, ',', '.'),
        number_format($dTotal, 0, ',', '.'),
        number_format($diff, 0, ',', '.'),
        $statusIcon
    );

    if ($gCount !== $dCount || $diff != 0) {
        $mismatches[$dt] = [
            'gopay' => $gopayByDate[$dt] ?? null,
            'db' => $dbByDate[$dt] ?? null,
            'diff' => $diff
        ];
    }
}

echo "\n";
file_put_contents('c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/scratch/mismatches_sept.json', json_encode($mismatches, JSON_PRETTY_PRINT));
