<?php

namespace App\Domains\DatabaseSync\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Exception;

class DatabaseSyncService
{
    /**
     * Dapatkan secret key sinkronisasi yang dikonfigurasi.
     */
    public static function getSecretKey(): string
    {
        return config('services.sync.secret') 
            ?: env('SYNC_SECRET_KEY', 'higo_pondok_sync_secret_key_2026_secure');
    }

    /**
     * Dapatkan URL endpoint ekspor database pada VPS.
     */
    public static function getVpsUrl(): string
    {
        return config('services.sync.vps_url') 
            ?: env('SYNC_VPS_URL', 'https://higo.lpialhidayah.or.id/api/db-sync/export');
    }

    /**
     * Validasi token secret yang dikirimkan.
     */
    public static function validateToken(?string $token): bool
    {
        $secret = self::getSecretKey();
        if (empty($secret) || empty($token)) {
            return false;
        }
        return hash_equals($secret, $token);
    }

    /**
     * Cek apakah aplikasi saat ini berjalan di lingkungan lokal / development.
     */
    public static function isLocal(): bool
    {
        if (app()->environment('local', 'testing')) {
            return true;
        }

        $host = request()->getHost();
        if (
            str_starts_with($host, 'localhost') ||
            str_starts_with($host, '127.0.0.1') ||
            str_ends_with($host, '.test') ||
            str_ends_with($host, '.local') ||
            preg_match('/^192\.168\./', $host) ||
            preg_match('/^10\./', $host)
        ) {
            return true;
        }

        return false;
    }

    /**
     * Ekspor seluruh struktur dan data database menjadi SQL dump.
     * 
     * @param bool $compress Jika true, dikompresi dengan gzip.
     * @return string
     */
    public function exportDump(bool $compress = true): string
    {
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        // 1. Coba gunakan mysqldump jika fungsi exec tersedia
        $dumpResult = $this->tryMysqldump();
        if ($dumpResult !== null && strlen($dumpResult) > 1000) {
            return $compress ? gzencode($dumpResult, 6) : $dumpResult;
        }

        // 2. Fallback: Pure PHP Dumper menggunakan PDO
        $pdo = DB::connection()->getPdo();
        $dbName = DB::connection()->getDatabaseName();

        $sql = "/* HIGO PONDOK DATABASE EXPORT (LPI AL HIDAYAH) */\n";
        $sql .= "/* Generated at: " . date('Y-m-d H:i:s') . " */\n\n";
        $sql .= "SET NAMES utf8mb4;\n";
        $sql .= "SET FOREIGN_KEY_CHECKS = 0;\n";
        $sql .= "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n";

        // Dump Base Tables
        $tablesStmt = $pdo->query("SHOW FULL TABLES FROM `{$dbName}` WHERE Table_type = 'BASE TABLE'");
        $tables = $tablesStmt->fetchAll(\PDO::FETCH_NUM);

        foreach ($tables as $tRow) {
            $tableName = $tRow[0];
            
            // Lewatkan data sesi web agar sesi aktif tidak tertimpa/tabrakan
            $isSessionTable = ($tableName === 'sessions');

            $sql .= "-- --------------------------------------------------------\n";
            $sql .= "-- Structure for table `{$tableName}`\n";
            $sql .= "-- --------------------------------------------------------\n";
            $sql .= "DROP TABLE IF EXISTS `{$tableName}`;\n";

            $createStmt = $pdo->query("SHOW CREATE TABLE `{$dbName}`.`{$tableName}`");
            $createRow = $createStmt->fetch(\PDO::FETCH_ASSOC);
            if (!empty($createRow['Create Table'])) {
                $sql .= $createRow['Create Table'] . ";\n\n";
            }

            if ($isSessionTable) {
                continue;
            }

            // Ekspor data per batch (250 baris)
            $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$dbName}`.`{$tableName}`");
            $count = (int)$countStmt->fetchColumn();

            if ($count > 0) {
                $sql .= "-- Data for table `{$tableName}` ({$count} rows)\n";
                $batchSize = 250;
                $offset = 0;

                while ($offset < $count) {
                    $rowsStmt = $pdo->query("SELECT * FROM `{$dbName}`.`{$tableName}` LIMIT {$batchSize} OFFSET {$offset}");
                    $rows = $rowsStmt->fetchAll(\PDO::FETCH_ASSOC);
                    if (empty($rows)) {
                        break;
                    }

                    $columns = array_keys($rows[0]);
                    $colList = implode('`, `', $columns);
                    $sql .= "INSERT INTO `{$tableName}` (`{$colList}`) VALUES\n";

                    $valueLines = [];
                    foreach ($rows as $row) {
                        $escapedVals = [];
                        foreach ($row as $val) {
                            if ($val === null) {
                                $escapedVals[] = 'NULL';
                            } else {
                                $escapedVals[] = $pdo->quote($val);
                            }
                        }
                        $valueLines[] = '(' . implode(', ', $escapedVals) . ')';
                    }

                    $sql .= implode(",\n", $valueLines) . ";\n";
                    $offset += $batchSize;
                }
                $sql .= "\n";
            }
        }

        // Dump Views (jika ada)
        $viewsStmt = $pdo->query("SHOW FULL TABLES FROM `{$dbName}` WHERE Table_type = 'VIEW'");
        $views = $viewsStmt->fetchAll(\PDO::FETCH_NUM);
        foreach ($views as $vRow) {
            $viewName = $vRow[0];
            $sql .= "-- --------------------------------------------------------\n";
            $sql .= "-- View structure for `{$viewName}`\n";
            $sql .= "-- --------------------------------------------------------\n";
            $sql .= "DROP VIEW IF EXISTS `{$viewName}`;\n";

            $createViewStmt = $pdo->query("SHOW CREATE VIEW `{$dbName}`.`{$viewName}`");
            $createView = $createViewStmt->fetch(\PDO::FETCH_ASSOC);
            if (!empty($createView['Create View'])) {
                $viewSql = $createView['Create View'];
                $viewSql = preg_replace('/CREATE ALGORITHM=[^\s]+ DEFINER=[^\s]+ SQL SECURITY DEFINER/', 'CREATE OR REPLACE SQL SECURITY INVOKER', $viewSql);
                $sql .= $viewSql . ";\n\n";
            }
        }

        $sql .= "SET FOREIGN_KEY_CHECKS = 1;\n";

        return $compress ? gzencode($sql, 6) : $sql;
    }

    /**
     * Impor SQL dump ke dalam database lokal.
     * 
     * @param string $rawDump SQL string biasa atau binary gzipped.
     * @return array Ringkasan eksekusi impor.
     */
    public function importDump(string $rawDump): array
    {
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        // Dekompresi jika format gzipped (magic bytes \x1f\x8b)
        if (str_starts_with($rawDump, "\x1f\x8b")) {
            $sql = gzdecode($rawDump);
            if ($sql === false) {
                throw new Exception('Gagal mendekompresi file dump gzip.');
            }
        } else {
            $sql = $rawDump;
        }

        if (empty(trim($sql))) {
            throw new Exception('Data dump SQL dari VPS kosong.');
        }

        // Pertahankan personal_access_tokens lokal agar admin lokal tidak ter-logout
        $localTokens = [];
        try {
            if (Schema::hasTable('personal_access_tokens')) {
                $localTokens = DB::table('personal_access_tokens')->get()->map(function ($item) {
                    return (array)$item;
                })->toArray();
            }
        } catch (\Throwable $e) {
            // Abaikan jika tabel belum tersedia
        }

        $pdo = DB::connection()->getPdo();
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
        $pdo->exec("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");

        $queries = $this->splitSqlQueries($sql);
        $executedCount = 0;
        $totalQueries = count($queries);

        foreach ($queries as $query) {
            $trimmed = trim($query);
            if (!empty($trimmed)) {
                $pdo->exec($trimmed);
                $executedCount++;
            }
        }

        // Kembalikan token lokal agar sesi login admin lokal tetap berjalan lancar
        if (!empty($localTokens) && Schema::hasTable('personal_access_tokens')) {
            foreach ($localTokens as $tokenData) {
                try {
                    DB::table('personal_access_tokens')->updateOrInsert(
                        ['id' => $tokenData['id']],
                        $tokenData
                    );
                } catch (\Throwable $e) {
                    // Abaikan jika token bentrok
                }
            }
        }

        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

        return [
            'success' => true,
            'queries_executed' => $executedCount,
            'total_queries' => $totalQueries,
            'timestamp' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Tarik dump database dari VPS jarak jauh dan langsung terapkan ke database lokal.
     * 
     * @param string|null $vpsUrl
     * @param string|null $secretKey
     * @return array
     */
    public function pullFromVps(?string $vpsUrl = null, ?string $secretKey = null): array
    {
        $vpsUrl = $vpsUrl ?: self::getVpsUrl();
        $secretKey = $secretKey ?: self::getSecretKey();

        if (empty($vpsUrl)) {
            throw new Exception('URL VPS belum dikonfigurasi pada .env (SYNC_VPS_URL).');
        }
        if (empty($secretKey)) {
            throw new Exception('Secret key sinkronisasi belum dikonfigurasi pada .env (SYNC_SECRET_KEY).');
        }

        try {
            $response = Http::timeout(300)
                ->connectTimeout(30)
                ->withoutVerifying() // Dukung Let's Encrypt / self-signed certificate
                ->withHeaders([
                    'X-Sync-Secret' => $secretKey,
                    'User-Agent' => 'HiGO-Pondok-Sync/1.0',
                    'Accept' => 'application/gzip, application/octet-stream, application/json',
                ])
                ->asForm()
                ->post($vpsUrl, [
                    'secret' => $secretKey,
                ]);
        } catch (Exception $e) {
            throw new Exception('Gagal menghubungi server VPS: ' . $e->getMessage());
        }

        $statusCode = $response->status();
        $body = $response->body();

        if (!$response->successful()) {
            $json = $response->json();
            $msg = $json['error'] ?? $json['message'] ?? "HTTP Status {$statusCode}";
            throw new Exception("Server VPS menolak sinkronisasi: {$msg}");
        }

        // Cek jika VPS mengembalikan pesan error dalam format JSON
        if (str_starts_with(trim($body), '{')) {
            $json = json_decode($body, true);
            if (isset($json['error'])) {
                throw new Exception("VPS Error: " . $json['error']);
            }
        }

        // Impor ke database lokal
        $importResult = $this->importDump($body);

        return [
            'success' => true,
            'message' => 'Database lokal berhasil disinkronkan dengan seluruh data live terkini dari VPS!',
            'details' => $importResult,
        ];
    }

    /**
     * Memisahkan multi-statement SQL menjadi array query individual yang bersih.
     */
    protected function splitSqlQueries(string $sql): array
    {
        $queries = [];
        $length = strlen($sql);
        $currentQuery = '';
        $inString = false;
        $stringChar = '';
        $escaped = false;

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];

            if ($inString) {
                $currentQuery .= $char;
                if ($escaped) {
                    $escaped = false;
                } elseif ($char === '\\') {
                    $escaped = true;
                } elseif ($char === $stringChar) {
                    $inString = false;
                }
            } else {
                if ($char === "'" || $char === '"' || $char === '`') {
                    $inString = true;
                    $stringChar = $char;
                    $currentQuery .= $char;
                } elseif ($char === ';') {
                    $trimmed = trim($currentQuery);
                    if (!empty($trimmed)) {
                        $queries[] = $trimmed;
                    }
                    $currentQuery = '';
                } else {
                    $currentQuery .= $char;
                }
            }
        }

        $trimmed = trim($currentQuery);
        if (!empty($trimmed)) {
            $queries[] = $trimmed;
        }

        return $queries;
    }

    /**
     * Coba eksekusi mysqldump jika terpasang pada OS.
     */
    protected function tryMysqldump(): ?string
    {
        if (!function_exists('exec') || in_array('exec', array_map('trim', explode(',', ini_get('disable_functions'))))) {
            return null;
        }

        try {
            $config = config('database.connections.' . config('database.default'));
            $host = escapeshellarg($config['host'] ?? '127.0.0.1');
            $port = escapeshellarg((string)($config['port'] ?? 3306));
            $user = escapeshellarg($config['username'] ?? 'root');
            $pass = !empty($config['password']) ? '-p' . escapeshellarg($config['password']) : '';
            $dbName = escapeshellarg($config['database'] ?? '');

            $cmd = "mysqldump -h {$host} -P {$port} -u {$user} {$pass} --single-transaction --skip-lock-tables {$dbName} 2>&1";
            $output = [];
            $retVal = 0;
            exec($cmd, $output, $retVal);

            if ($retVal === 0 && !empty($output)) {
                $dump = implode("\n", $output);
                if (strlen($dump) > 1000) {
                    return $dump;
                }
            }
        } catch (\Throwable $e) {
            // Abaikan, gunakan fallback PHP dumper
        }

        return null;
    }
}
