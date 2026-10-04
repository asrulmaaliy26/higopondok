<?php

namespace App\Domains\DatabaseSync\Commands;

use App\Domains\DatabaseSync\Services\DatabaseSyncService;
use Illuminate\Console\Command;
use Exception;

class DbPullVpsCommand extends Command
{
    /**
     * Nama dan signature perintah command.
     */
    protected $signature = 'db:pull-vps {--url= : URL endpoint VPS khusus} {--secret= : Secret key khusus}';

    /**
     * Deskripsi perintah command.
     */
    protected $description = 'Tarik dan sinkronkan database lokal secara otomatis dari VPS';

    /**
     * Eksekusi perintah.
     */
    public function handle(DatabaseSyncService $service): int
    {
        $this->newLine();
        $this->info("==================================================");
        $this->info("       SINKRONISASI DATABASE HIGO PONDOK         ");
        $this->info("==================================================");

        $vpsUrl = $this->option('url') ?: DatabaseSyncService::getVpsUrl();
        $secret = $this->option('secret') ?: DatabaseSyncService::getSecretKey();

        $this->line("Target VPS : <comment>{$vpsUrl}</comment>");
        $this->line("Database   : <comment>" . config('database.connections.' . config('database.default') . '.database') . "</comment>");
        $this->line("Status     : Menghubungi server VPS...");

        try {
            $result = $service->pullFromVps($vpsUrl, $secret);

            $this->newLine();
            $this->info("✅ SUKSES!");
            $this->info($result['message'] ?? 'Database berhasil disinkronkan!');

            if (isset($result['details'])) {
                $d = $result['details'];
                $this->line("Eksekusi query : " . ($d['queries_executed'] ?? 0) . " / " . ($d['total_queries'] ?? 0));
                $this->line("Waktu selesai  : " . ($d['timestamp'] ?? date('Y-m-d H:i:s')));
            }

            return Command::SUCCESS;
        } catch (Exception $e) {
            $this->newLine();
            $this->error("❌ GAGAL: " . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
