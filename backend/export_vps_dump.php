<?php
// Script ekspor otomatis dari database staialmannan_higopondok ke data_import_vps.sql
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db   = 'staialmannan_higopondok';

$pdo = new PDO("mysql:host={$host};dbname={$db};charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$tables = [
    'users',
    'model_has_roles',
    'canteens',
    'products',
    'orders',
    'order_items',
    'payment_logs',
    'canteen_ledgers',
    'vouchers',
    'user_vouchers',
];

$outputFile = __DIR__ . '/data_import_vps.sql';
$fp = fopen($outputFile, 'w');

fwrite($fp, "-- =====================================================\n");
fwrite($fp, "-- DATA EXPORT MANDIRI UNTUK VPS (STANDALONE SQL DUMP)\n");
fwrite($fp, "-- Database Target: staialmannan_higopondok (atau nama DB di VPS)\n");
fwrite($fp, "-- Generated: " . date('Y-m-d H:i:s') . "\n");
fwrite($fp, "-- =====================================================\n\n");
fwrite($fp, "SET FOREIGN_KEY_CHECKS = 0;\n");
fwrite($fp, "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n");
fwrite($fp, "SET time_zone = '+07:00';\n\n");

foreach ($tables as $table) {
    $exists = $pdo->query("SHOW TABLES LIKE '{$table}'")->fetch();
    if (!$exists) {
        echo "Skipping non-existent table {$table}...\n";
        continue;
    }
    echo "Exporting {$table}...\n";
    $count = $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    fwrite($fp, "\n-- -----------------------------------------------------\n");
    fwrite($fp, "-- Table: {$table} ({$count} rows)\n");
    fwrite($fp, "-- -----------------------------------------------------\n");

    if ($count == 0) {
        continue;
    }

    $stmt = $pdo->query("SELECT * FROM `{$table}`");
    $columns = [];
    for ($i = 0; $i < $stmt->columnCount(); $i++) {
        $meta = $stmt->getColumnMeta($i);
        $columns[] = "`" . $meta['name'] . "`";
    }
    $colList = implode(', ', $columns);

    $batchSize = 200;
    $rowsBatch = [];

    while ($row = $stmt->fetch()) {
        $values = [];
        foreach ($row as $val) {
            if ($val === null) {
                $values[] = 'NULL';
            } else {
                $values[] = $pdo->quote($val);
            }
        }
        $rowsBatch[] = "(" . implode(', ', $values) . ")";

        if (count($rowsBatch) >= $batchSize) {
            fwrite($fp, "REPLACE INTO `{$table}` ({$colList}) VALUES\n");
            fwrite($fp, implode(",\n", $rowsBatch) . ";\n");
            $rowsBatch = [];
        }
    }

    if (!empty($rowsBatch)) {
        fwrite($fp, "REPLACE INTO `{$table}` ({$colList}) VALUES\n");
        fwrite($fp, implode(",\n", $rowsBatch) . ";\n");
    }
}

fwrite($fp, "\nSET FOREIGN_KEY_CHECKS = 1;\n");
fclose($fp);

echo "Export SELESAI! File tersimpan di {$outputFile}\n";
