<?php

namespace App\Domains\Admin\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Admin\GoogleDriveAccount;
use App\Domains\Admin\ActivityLog;
use App\Domains\Admin\Requests\StoreGoogleDriveAccountRequest;
use App\Domains\Admin\Requests\UpdateGoogleDriveAccountRequest;
use App\Domains\Admin\Requests\ExchangeGoogleDriveOAuthRequest;
use App\Domains\Admin\Resources\GoogleDriveAccountResource;
use App\Domains\Canteen\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GoogleDriveStorageController extends Controller
{
    /**
     * Daftar seluruh akun penyimpanan Google Drive beserta status & kuotanya
     */
    public function index(Request $request)
    {
        $accounts = GoogleDriveAccount::orderByDesc('is_active')
            ->orderBy('id', 'asc')
            ->get();

        // Jika tabel masih kosong, inisialisasi dari .env
        if ($accounts->isEmpty()) {
            $default = $this->seedDefaultAccountFromEnv();
            if ($default) {
                $accounts = collect([$default]);
            }
        }

        $activeAccount = $accounts->firstWhere('is_active', true) ?? $accounts->first();

        // Hitung jumlah pesanan yang masih memiliki file bukti lokal (belum masuk Google Drive)
        $localPendingCount = Order::where(function ($q) {
            $q->where('proof_of_payment', 'like', '%03_bukti_transaksi%')
              ->orWhere('proof_of_delivery', 'like', '%03_bukti_transaksi%')
              ->orWhere('proof_of_purchase', 'like', '%03_bukti_transaksi%');
        })->count();

        return response()->json([
            'accounts' => GoogleDriveAccountResource::collection($accounts),
            'active_account' => $activeAccount ? new GoogleDriveAccountResource($activeAccount) : null,
            'local_pending_count' => $localPendingCount,
            'default_client_id' => config('filesystems.disks.google.clientId'),
            'oauth_Callback_url' => url('/api/admin/gdrive-accounts/oauth-callback'),
        ]);
    }

    /**
     * Tambah akun Google Drive baru
     */
    public function store(StoreGoogleDriveAccountRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $data = $request->validated();
            $data['folder_id'] = GoogleDriveAccount::extractFolderId($data['folder_id'] ?? null);
            $data['folder_name'] = $data['folder_name'] ?? 'Higo Pondok Storage';

            $shouldActivate = !empty($data['is_active']) || GoogleDriveAccount::count() === 0;
            if ($shouldActivate) {
                GoogleDriveAccount::query()->update(['is_active' => false]);
                $data['is_active'] = true;
            }

            $account = GoogleDriveAccount::create($data);

            // Jika memiliki refresh_token, langsung cek koneksi, tarik email & kuota dari Google API
            if (!empty($account->refresh_token)) {
                $this->refreshAccountMetadata($account, true);
            }

            if ($account->is_active) {
                GoogleDriveAccount::purgeStorageDiskCache();
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'create_gdrive_account',
                'model_type' => GoogleDriveAccount::class,
                'model_id' => $account->id,
                'description' => "Superadmin {$request->user()->name} menambahkan akun penyimpanan Google Drive: {$account->name} ({$account->email})",
            ]);

            return response()->json([
                'message' => 'Akun penyimpanan Google Drive berhasil ditambahkan!',
                'account' => new GoogleDriveAccountResource($account->fresh()),
            ], 201);
        });
    }

    /**
     * Perbarui data akun Google Drive
     */
    public function update(UpdateGoogleDriveAccountRequest $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $account = GoogleDriveAccount::findOrFail($id);
            $data = $request->validated();

            if (array_key_exists('folder_id', $data)) {
                $data['folder_id'] = GoogleDriveAccount::extractFolderId($data['folder_id']);
            }

            // Jangan timpa refresh_token atau client_secret jika dikirim string kosong pada mode edit
            if (array_key_exists('refresh_token', $data) && empty(trim((string) $data['refresh_token']))) {
                unset($data['refresh_token']);
            }
            if (array_key_exists('client_secret', $data) && empty(trim((string) $data['client_secret']))) {
                unset($data['client_secret']);
            }

            if (!empty($data['is_active']) && !$account->is_active) {
                GoogleDriveAccount::where('id', '!=', $account->id)->update(['is_active' => false]);
            }

            $account->update($data);

            if ($request->filled('refresh_token')) {
                $this->refreshAccountMetadata($account, empty($account->folder_id));
            }

            GoogleDriveAccount::purgeStorageDiskCache();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'update_gdrive_account',
                'model_type' => GoogleDriveAccount::class,
                'model_id' => $account->id,
                'description' => "Superadmin {$request->user()->name} memperbarui konfigurasi Google Drive: {$account->name} ({$account->email})",
            ]);

            return response()->json([
                'message' => 'Konfigurasi Google Drive berhasil diperbarui!',
                'account' => new GoogleDriveAccountResource($account->fresh()),
            ]);
        });
    }

    /**
     * Ganti (Switch) akun Google Drive aktif secara instan (1-Klik)
     */
    public function activate(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $account = GoogleDriveAccount::findOrFail($id);

            GoogleDriveAccount::query()->update(['is_active' => false]);
            $account->is_active = true;
            $account->save();

            // Cek status & kuota terbaru jika memungkinkan
            if (!empty($account->refresh_token)) {
                $this->refreshAccountMetadata($account, empty($account->folder_id));
            }

            // Bersihkan cache disk agar Laravel langsung memakai akun Drive ini
            GoogleDriveAccount::purgeStorageDiskCache();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'switch_gdrive_account',
                'model_type' => GoogleDriveAccount::class,
                'model_id' => $account->id,
                'description' => "Superadmin {$request->user()->name} mengganti penyimpanan Google Drive aktif ke: {$account->name} ({$account->email})",
            ]);

            return response()->json([
                'message' => "Penyimpanan aktif berhasil dialihkan ke {$account->name} ({$account->email})!",
                'account' => new GoogleDriveAccountResource($account->fresh()),
            ]);
        });
    }

    /**
     * Cek koneksi & perbarui kuota kapasitas Google Drive dari Google API
     */
    public function checkConnection(Request $request, $id)
    {
        $account = GoogleDriveAccount::findOrFail($id);
        $ok = $this->refreshAccountMetadata($account, false);

        if ($account->is_active) {
            GoogleDriveAccount::purgeStorageDiskCache();
        }

        return response()->json([
            'success' => $ok,
            'message' => $ok
                ? "Terhubung ke Google Drive ({$account->email})! Terpakai: {$account->storage_used_formatted} / {$account->storage_limit_formatted}."
                : "Gagal terhubung ke Google Drive: {$account->status_message}",
            'account' => new GoogleDriveAccountResource($account->fresh()),
        ]);
    }

    /**
     * Buat folder standar Higo Pondok otomatis di akun Google Drive tersebut
     */
    public function createStandardFolders(Request $request, $id)
    {
        $account = GoogleDriveAccount::findOrFail($id);

        try {
            $client = $account->buildGoogleClient();
            $service = new \Google\Service\Drive($client);

            $rootFolderName = $request->input('folder_name') ?: ($account->folder_name ?: 'Higo Pondok Storage');

            // Buat folder utama
            $folderMeta = new \Google\Service\Drive\DriveFile([
                'name' => $rootFolderName,
                'mimeType' => 'application/vnd.google-apps.folder',
            ]);

            $createdRoot = $service->files->create($folderMeta, ['fields' => 'id, name']);
            $rootFolderId = $createdRoot->id;

            // Set permission agar link bukti dapat dilihat oleh admin/kurir
            try {
                $perm = new \Google\Service\Drive\Permission([
                    'type' => 'anyone',
                    'role' => 'reader',
                ]);
                $service->permissions->create($rootFolderId, $perm);
            } catch (\Throwable $permErr) {
                Log::warning("Gagal set public reader permission pada folder Drive {$rootFolderId}: " . $permErr->getMessage());
            }

            // Buat 4 subfolder standar di dalam root folder
            $subFolders = [
                '01_master_toko',
                '02_katalog_produk',
                '03_bukti_transaksi',
                '04_laporan_keuangan',
            ];

            foreach ($subFolders as $subName) {
                $subMeta = new \Google\Service\Drive\DriveFile([
                    'name' => $subName,
                    'mimeType' => 'application/vnd.google-apps.folder',
                    'parents' => [$rootFolderId],
                ]);
                $service->files->create($subMeta, ['fields' => 'id']);
            }

            $account->folder_id = $rootFolderId;
            $account->folder_name = $rootFolderName;
            $account->save();

            $this->refreshAccountMetadata($account, false);

            if ($account->is_active) {
                GoogleDriveAccount::purgeStorageDiskCache();
            }

            return response()->json([
                'message' => "Folder '{$rootFolderName}' beserta 4 subfolder standar berhasil dibuat otomatis di Google Drive ({$account->email})!",
                'account' => new GoogleDriveAccountResource($account->fresh()),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal membuat folder di Google Drive: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Generate Google OAuth URL untuk menautkan akun email Google Drive baru atau memperbarui token
     */
    public function getOAuthUrl(Request $request)
    {
        $accountId = $request->query('account_id');
        $account = $accountId ? GoogleDriveAccount::find($accountId) : null;

        $defaultConfig = config('filesystems.disks.google', []);
        $clientId = $account?->client_id ?: ($defaultConfig['clientId'] ?? env('GOOGLE_DRIVE_CLIENT_ID'));
        $clientSecret = $account?->client_secret ?: ($defaultConfig['clientSecret'] ?? env('GOOGLE_DRIVE_CLIENT_SECRET'));

        $redirectUri = $request->query('redirect_uri') ?: url('/api/admin/gdrive-accounts/oauth-callback');

        $client = new \Google\Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($redirectUri);
        $client->setAccessType('offline');
        $client->setPrompt('consent select_account');
        $client->addScope(\Google\Service\Drive::DRIVE);
        $client->addScope('email');
        $client->addScope('profile');

        $statePayload = base64_encode(json_encode([
            'account_id' => $account?->id,
            'redirect_uri' => $redirectUri,
            'set_active' => $request->boolean('set_active', true),
        ]));
        $client->setState($statePayload);

        return response()->json([
            'auth_url' => $client->createAuthUrl(),
            'redirect_uri' => $redirectUri,
            'client_id' => $clientId,
        ]);
    }

    /**
     * Callback GET dari Google OAuth Popup (Menukar code & menutup popup otomatis)
     */
    public function handleOAuthCallback(Request $request)
    {
        $code = $request->query('code');
        $error = $request->query('error');
        $stateRaw = $request->query('state');
        $state = $stateRaw ? json_decode(base64_decode($stateRaw), true) : [];

        if ($error || !$code) {
            return response()->make($this->renderPopupHtml(false, 'Otorisasi Google dibatalkan atau gagal: ' . ($error ?: 'Code kosong')), 200, ['Content-Type' => 'text/html']);
        }

        try {
            $accountId = $state['account_id'] ?? null;
            $redirectUri = $state['redirect_uri'] ?? url('/api/admin/gdrive-accounts/oauth-callback');
            $setActive = $state['set_active'] ?? true;

            $account = $this->processOAuthCodeExchange($code, $redirectUri, $accountId, null, null, (bool) $setActive);

            return response()->make(
                $this->renderPopupHtml(true, "Berhasil menautkan Google Drive ({$account->email})!", $account),
                200,
                ['Content-Type' => 'text/html']
            );
        } catch (\Throwable $e) {
            return response()->make(
                $this->renderPopupHtml(false, 'Gagal menukar token OAuth: ' . $e->getMessage()),
                200,
                ['Content-Type' => 'text/html']
            );
        }
    }

    /**
     * Tukar Authorization Code OAuth secara manual / via API
     */
    public function exchangeOAuthCode(ExchangeGoogleDriveOAuthRequest $request)
    {
        try {
            $data = $request->validated();
            $redirectUri = $data['redirect_uri'] ?: 'https://developers.google.com/oauthplayground';

            $account = $this->processOAuthCodeExchange(
                $data['code'],
                $redirectUri,
                $data['account_id'] ?? null,
                $data['name'] ?? null,
                $data['folder_id'] ?? null,
                (bool) ($data['set_active'] ?? true)
            );

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'oauth_link_gdrive_account',
                'model_type' => GoogleDriveAccount::class,
                'model_id' => $account->id,
                'description' => "Superadmin {$request->user()->name} menautkan ulang OAuth Google Drive: {$account->name} ({$account->email})",
            ]);

            return response()->json([
                'message' => "Akun Google Drive ({$account->email}) berhasil ditautkan!",
                'account' => new GoogleDriveAccountResource($account->fresh()),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal menukar kode otorisasi Google: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Sinkronkan berkas bukti transaksi lokal yang tertunda ke Google Drive yang sedang aktif
     */
    public function syncPendingLocalFiles(Request $request)
    {
        $activeAccount = GoogleDriveAccount::active()->first();
        if (!$activeAccount) {
            return response()->json([
                'message' => 'Tidak ada akun Google Drive yang aktif.',
            ], 422);
        }

        $ok = $this->refreshAccountMetadata($activeAccount, empty($activeAccount->folder_id));
        if (!$ok) {
            return response()->json([
                'message' => "Akun Google Drive aktif ({$activeAccount->email}) belum terhubung dengan benar: {$activeAccount->status_message}",
            ], 422);
        }

        GoogleDriveAccount::purgeStorageDiskCache();

        $orders = Order::where(function ($q) {
            $q->where('proof_of_payment', 'like', '%03_bukti_transaksi%')
              ->orWhere('proof_of_delivery', 'like', '%03_bukti_transaksi%')
              ->orWhere('proof_of_purchase', 'like', '%03_bukti_transaksi%');
        })->orderByDesc('id')->limit(30)->get();

        $syncedCount = 0;
        foreach ($orders as $order) {
            $beforePayment = json_encode($order->proof_of_payment);
            $beforeDelivery = json_encode($order->proof_of_delivery);
            $beforePurchase = json_encode($order->proof_of_purchase);

            $this->syncProofToGoogleDrive($order, 'proof_of_payment');
            $this->syncProofToGoogleDrive($order, 'proof_of_delivery');
            $this->syncProofToGoogleDrive($order, 'proof_of_purchase');

            $order->refresh();
            if (
                json_encode($order->proof_of_payment) !== $beforePayment ||
                json_encode($order->proof_of_delivery) !== $beforeDelivery ||
                json_encode($order->proof_of_purchase) !== $beforePurchase
            ) {
                $syncedCount++;
            }
        }

        // Perbarui kuota setelah sinkronisasi
        $this->refreshAccountMetadata($activeAccount, false);

        return response()->json([
            'message' => $syncedCount > 0
                ? "Berhasil mencadangkan {$syncedCount} pesanan dari penyimpanan lokal ke Google Drive ({$activeAccount->email})!"
                : "Tidak ada berkas fisik lokal baru yang perlu dicadangkan (atau berkas lokal sudah berada di Drive).",
            'synced_count' => $syncedCount,
            'active_account' => new GoogleDriveAccountResource($activeAccount->fresh()),
        ]);
    }

    /**
     * Hapus akun penyimpanan Google Drive
     */
    public function destroy(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $account = GoogleDriveAccount::findOrFail($id);

            if (GoogleDriveAccount::count() <= 1) {
                return response()->json([
                    'message' => 'Minimal harus ada 1 akun penyimpanan Google Drive yang terdaftar.',
                ], 422);
            }

            $wasActive = $account->is_active;
            $name = $account->name;
            $email = $account->email;
            $account->delete();

            if ($wasActive) {
                $next = GoogleDriveAccount::orderBy('id', 'asc')->first();
                if ($next) {
                    $next->update(['is_active' => true]);
                }
                GoogleDriveAccount::purgeStorageDiskCache();
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'delete_gdrive_account',
                'model_type' => GoogleDriveAccount::class,
                'model_id' => $id,
                'description' => "Superadmin {$request->user()->name} menghapus akun penyimpanan Google Drive: {$name} ({$email})",
            ]);

            return response()->json([
                'message' => "Akun Google Drive {$name} berhasil dihapus.",
            ]);
        });
    }

    // ==========================================
    // INTERNAL HELPERS
    // ==========================================

    private function processOAuthCodeExchange(
        string $code,
        string $redirectUri,
        ?int $accountId = null,
        ?string $customName = null,
        ?string $folderIdInput = null,
        bool $setActive = true
    ): GoogleDriveAccount {
        $existing = $accountId ? GoogleDriveAccount::find($accountId) : null;
        $defaultConfig = config('filesystems.disks.google', []);

        $clientId = $existing?->client_id ?: ($defaultConfig['clientId'] ?? env('GOOGLE_DRIVE_CLIENT_ID'));
        $clientSecret = $existing?->client_secret ?: ($defaultConfig['clientSecret'] ?? env('GOOGLE_DRIVE_CLIENT_SECRET'));

        $client = new \Google\Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri($redirectUri);

        $token = $client->fetchAccessTokenWithAuthCode(trim($code));
        if (is_array($token) && isset($token['error'])) {
            throw new \RuntimeException($token['error_description'] ?? $token['error']);
        }

        $refreshToken = $token['refresh_token'] ?? $existing?->refresh_token;
        if (empty($refreshToken)) {
            throw new \RuntimeException('Google tidak mengembalikan refresh_token. Pastikan Anda menyetujui izin akses (offline access).');
        }

        $client->setAccessToken($token);
        $service = new \Google\Service\Drive($client);
        $about = $service->about->get(['fields' => 'user,storageQuota']);

        $email = $about->getUser()?->getEmailAddress();
        $displayName = $about->getUser()?->getDisplayName();
        $used = (int) ($about->getStorageQuota()?->getUsage() ?? 0);
        $limit = (int) ($about->getStorageQuota()?->getLimit() ?? 16106127360);

        return DB::transaction(function () use (
            $existing,
            $email,
            $displayName,
            $customName,
            $folderIdInput,
            $clientId,
            $clientSecret,
            $refreshToken,
            $used,
            $limit,
            $setActive
        ) {
            // Jika tidak ada accountId spesifik namun email sudah pernah terdaftar, update akun tersebut
            $target = $existing ?: ($email ? GoogleDriveAccount::where('email', $email)->first() : null);

            if ($setActive) {
                GoogleDriveAccount::query()->update(['is_active' => false]);
            }

            $folderId = GoogleDriveAccount::extractFolderId($folderIdInput) ?: $target?->folder_id;

            if ($target) {
                $target->update([
                    'name' => $customName ?: $target->name ?: ("Drive " . ($displayName ?: $email)),
                    'email' => $email ?: $target->email,
                    'refresh_token' => $refreshToken,
                    'folder_id' => $folderId,
                    'is_active' => $setActive ? true : $target->is_active,
                    'status' => ($limit > 0 && ($used / $limit) >= 0.98) ? 'full' : 'connected',
                    'status_message' => 'Terhubung & siap digunakan',
                    'storage_used' => $used,
                    'storage_limit' => $limit ?: 16106127360,
                    'last_checked_at' => now(),
                ]);
                $account = $target;
            } else {
                $account = GoogleDriveAccount::create([
                    'name' => $customName ?: ("Drive Backup - " . ($displayName ?: $email ?: 'Akun Baru')),
                    'email' => $email,
                    'client_id' => $clientId,
                    'client_secret' => $clientSecret,
                    'refresh_token' => $refreshToken,
                    'folder_id' => $folderId,
                    'folder_name' => 'Higo Pondok Storage',
                    'is_active' => $setActive || GoogleDriveAccount::count() === 0,
                    'status' => ($limit > 0 && ($used / $limit) >= 0.98) ? 'full' : 'connected',
                    'status_message' => 'Terhubung & siap digunakan',
                    'storage_used' => $used,
                    'storage_limit' => $limit ?: 16106127360,
                    'auto_switch_when_full' => true,
                    'last_checked_at' => now(),
                ]);
            }

            // Jika belum memiliki folder_id, otomatis buatkan folder Higo Pondok Storage di Drive tersebut
            if (empty($account->folder_id)) {
                $this->refreshAccountMetadata($account, true);
            }

            GoogleDriveAccount::purgeStorageDiskCache();

            return $account;
        });
    }

    /**
     * Tarik metadata email & kuota dari Google Drive API, dan opsional buat folder jika belum ada
     */
    public function refreshAccountMetadata(GoogleDriveAccount $account, bool $autoCreateFolderIfEmpty = false): bool
    {
        try {
            $client = $account->buildGoogleClient();
            $service = new \Google\Service\Drive($client);

            $about = $service->about->get(['fields' => 'user,storageQuota']);
            $email = $about->getUser()?->getEmailAddress();
            $used = (int) ($about->getStorageQuota()?->getUsage() ?? 0);
            $limit = (int) ($about->getStorageQuota()?->getLimit() ?? 16106127360);

            if ($email) {
                $account->email = $email;
            }

            $account->storage_used = $used;
            $account->storage_limit = $limit > 0 ? $limit : 16106127360;
            $account->status = ($account->storage_limit > 0 && ($used / $account->storage_limit) >= 0.98) ? 'full' : 'connected';
            $account->status_message = 'Terhubung normal ke Google Drive API';
            $account->last_checked_at = now();

            // Cek atau buat folder utama otomatis
            if (empty($account->folder_id) && $autoCreateFolderIfEmpty) {
                $folderName = $account->folder_name ?: 'Higo Pondok Storage';
                $folderMeta = new \Google\Service\Drive\DriveFile([
                    'name' => $folderName,
                    'mimeType' => 'application/vnd.google-apps.folder',
                ]);
                $created = $service->files->create($folderMeta, ['fields' => 'id, name']);
                $account->folder_id = $created->id;
                $account->folder_name = $created->name;

                try {
                    $perm = new \Google\Service\Drive\Permission([
                        'type' => 'anyone',
                        'role' => 'reader',
                    ]);
                    $service->permissions->create($created->id, $perm);
                } catch (\Throwable $e) {
                    // Ignore permission error
                }
            } elseif (!empty($account->folder_id)) {
                try {
                    $f = $service->files->get($account->folder_id, ['fields' => 'id, name', 'supportsAllDrives' => true]);
                    if (!empty($f->name)) {
                        $account->folder_name = $f->name;
                    }
                } catch (\Throwable $folderErr) {
                    // Folder mungkin milik akun lain atau belum dibagikan
                }
            }

            $account->save();
            return true;
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            $account->status = (str_contains(strtolower($msg), 'invalid_grant') || str_contains(strtolower($msg), 'expired') || str_contains(strtolower($msg), 'revoked'))
                ? 'expired'
                : 'error';
            $account->status_message = $msg;
            $account->last_checked_at = now();
            $account->save();
            return false;
        }
    }

    private function seedDefaultAccountFromEnv(): ?GoogleDriveAccount
    {
        $config = config('filesystems.disks.google', []);
        if (empty($config['clientId']) && empty($config['refreshToken']) && empty($config['sharedFolderId'])) {
            return null;
        }

        $account = GoogleDriveAccount::create([
            'name' => 'Drive Utama Higo Pondok (Default)',
            'email' => env('MAIL_FROM_ADDRESS', 'higopondok@gmail.com'),
            'client_id' => $config['clientId'] ?? null,
            'client_secret' => $config['clientSecret'] ?? null,
            'refresh_token' => $config['refreshToken'] ?? null,
            'folder_id' => $config['sharedFolderId'] ?? '1ksLwc4S9MohrBTH4YISZOEhR5inWIbcH',
            'folder_name' => 'Folder Utama Higo Pondok',
            'is_active' => true,
            'status' => 'unknown',
            'storage_used' => 0,
            'storage_limit' => 16106127360,
            'auto_switch_when_full' => true,
            'notes' => 'Akun penyimpanan bawaan dari konfigurasi awal server (.env)',
        ]);

        $this->refreshAccountMetadata($account, false);
        return $account;
    }

    private function renderPopupHtml(bool $success, string $message, ?GoogleDriveAccount $account = null): string
    {
        $payload = json_encode([
            'type' => 'GDRIVE_OAUTH_RESULT',
            'success' => $success,
            'message' => $message,
            'account_id' => $account?->id,
            'email' => $account?->email,
        ]);

        $color = $success ? '#15803d' : '#dc2626';
        $title = $success ? 'Berhasil Ditautkan!' : 'Gagal Menautkan';

        return <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>{$title}</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #fff; border: 2px solid {$color}; padding: 24px; max-width: 400px; text-align: center; }
        h2 { color: {$color}; margin: 0 0 8px; font-size: 18px; }
        p { color: #334155; font-size: 13px; margin: 0 0 16px; }
        button { background: {$color}; color: #fff; border: none; padding: 8px 16px; font-weight: bold; cursor: pointer; }
    </style>
</head>
<body>
    <div class="card">
        <h2>{$title}</h2>
        <p>{$message}</p>
        <button onclick="window.close()">Tutup Jendela</button>
    </div>
    <script>
        try {
            if (window.opener) {
                window.opener.postMessage({$payload}, '*');
                setTimeout(() => window.close(), 1200);
            }
        } catch (e) {}
    </script>
</body>
</html>
HTML;
    }
}

