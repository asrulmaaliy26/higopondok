<?php

namespace App\Domains\DatabaseSync\Controllers;

use App\Domains\DatabaseSync\Services\DatabaseSyncService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Exception;

class DatabaseSyncController extends Controller
{
    protected DatabaseSyncService $syncService;

    public function __construct(DatabaseSyncService $syncService)
    {
        $this->syncService = $syncService;
    }

    /**
     * Endpoint VPS untuk mengunduh dump database secara aman (.sql.gz).
     * Dapat dipanggil melalui GET/POST dengan header 'X-Sync-Secret' atau parameter 'secret'.
     */
    public function export(Request $request): Response|JsonResponse
    {
        $token = $request->header('X-Sync-Secret')
            ?: $request->input('secret');

        if (!DatabaseSyncService::validateToken($token)) {
            Log::warning('Percobaan ekspor database gagal: secret token tidak valid dari IP ' . $request->ip());
            return response()->json([
                'success' => false,
                'error'   => 'Akses ditolak. Secret token sinkronisasi tidak valid atau belum dikonfigurasi.',
            ], 403);
        }

        try {
            $dumpGz = $this->syncService->exportDump(true);
            $filename = 'higo_pondok_db_' . date('Ymd_His') . '.sql.gz';

            return response($dumpGz, 200, [
                'Content-Type'        => 'application/gzip',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length'      => strlen($dumpGz),
                'Cache-Control'       => 'no-store, no-cache, must-revalidate',
            ]);
        } catch (Exception $e) {
            Log::error('Error generate database export: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error'   => 'Gagal mengekspor database: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Endpoint lokal untuk menarik dan menyinkronkan database langsung dari VPS.
     * Hanya dapat diakses oleh user dengan role admin.
     */
    public function pull(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'error'   => 'Hanya Administrator yang memiliki izin untuk menyinkronkan database dari VPS.',
            ], 403);
        }

        try {
            $result = $this->syncService->pullFromVps();

            return response()->json([
                'success' => true,
                'message' => $result['message'] ?? 'Database berhasil disinkronkan dari VPS!',
                'details' => $result['details'] ?? [],
            ]);
        } catch (Exception $e) {
            Log::error('Database sync pull error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Endpoint informasi status sinkronisasi (apakah sedang di lokal atau VPS).
     */
    public function status(Request $request): JsonResponse
    {
        $isLocal = DatabaseSyncService::isLocal();
        $secret = DatabaseSyncService::getSecretKey();

        return response()->json([
            'is_local'    => $isLocal,
            'vps_url'     => DatabaseSyncService::getVpsUrl(),
            'export_url'  => url('/api/db-sync/export?secret=' . $secret),
            'database'    => config('database.connections.' . config('database.default') . '.database'),
        ]);
    }
}
