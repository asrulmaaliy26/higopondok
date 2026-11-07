<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Storage;
use App\Domains\Admin\GoogleDriveAccount;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            Storage::extend('google', function ($app, $config) {
                // Gunakan akun Google Drive yang sedang aktif di database (fallback ke config/.env)
                $dynamicConfig = GoogleDriveAccount::getActiveConfig();
                $mergedConfig = array_merge($config, array_filter($dynamicConfig, fn($v) => $v !== null && $v !== ''));

                $options = [];

                if (!empty($mergedConfig['teamDriveId'])) {
                    $options['teamDriveId'] = $mergedConfig['teamDriveId'];
                }

                if (!empty($mergedConfig['sharedFolderId'])) {
                    $options['sharedFolderId'] = $mergedConfig['sharedFolderId'];
                }

                $client = new \Google\Client();

                if (!empty($mergedConfig['serviceAccountJson']) && file_exists($mergedConfig['serviceAccountJson'])) {
                    $client->setAuthConfig($mergedConfig['serviceAccountJson']);
                } elseif (!empty($mergedConfig['clientId']) && !empty($mergedConfig['clientSecret']) && !empty($mergedConfig['refreshToken'])) {
                    $client->setClientId($mergedConfig['clientId']);
                    $client->setClientSecret($mergedConfig['clientSecret']);
                    $token = $client->fetchAccessTokenWithRefreshToken($mergedConfig['refreshToken']);
                    if (is_array($token) && isset($token['error'])) {
                        throw new \RuntimeException('Google Drive OAuth token error: ' . ($token['error_description'] ?? $token['error']));
                    }
                }

                $client->addScope(\Google\Service\Drive::DRIVE);

                $service = new \Google\Service\Drive($client);
                $adapter = new \Masbug\Flysystem\GoogleDriveAdapter($service, $mergedConfig['folder'] ?? '/', $options);
                $driver = new \League\Flysystem\Filesystem($adapter);

                return new \Illuminate\Filesystem\FilesystemAdapter($driver, $adapter);
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Google Drive storage driver failed to initialize: ' . $e->getMessage());
        }
    }
}
