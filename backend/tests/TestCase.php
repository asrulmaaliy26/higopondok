<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        if (\Illuminate\Support\Facades\Schema::hasTable('roles')) {
            foreach (['super_admin', 'admin', 'user', 'kantin', 'kurir'] as $roleName) {
                \Spatie\Permission\Models\Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            }
        }
    }
}
