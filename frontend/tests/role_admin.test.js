import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, closeViteServer } from './loadComponent.js';
import { ROLES } from '../src/config/roles.js';

describe('Unit Test: Role ADMIN & SUPER ADMIN Pages', () => {
  after(async () => {
    await closeViteServer();
  });

  it('1. Halaman Manajemen Semua Pesanan (AdminPesanan.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/AdminPesanan.jsx');
    assert.ok(mod, 'Modul AdminPesanan harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'AdminPesanan harus mengekspor komponen React');
  });

  it('2. Halaman Manajemen Pengguna Santri & User (UserManagement.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/UserManagement.jsx');
    assert.ok(mod, 'Modul UserManagement harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'UserManagement harus mengekspor komponen React');
  });

  it('3. Halaman Manajemen Pertokoan (Pertokoan.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Pertokoan.jsx');
    assert.ok(mod, 'Modul Pertokoan harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Pertokoan harus mengekspor komponen React');
  });

  it('4. Halaman Log Aktivitas Audit Admin (AdminLogs.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/AdminLogs.jsx');
    assert.ok(mod, 'Modul AdminLogs harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'AdminLogs harus mengekspor komponen React');
  });

  it('5. Halaman Manajemen Voucher Global (AdminVouchers.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/AdminVouchers.jsx');
    assert.ok(mod, 'Modul AdminVouchers harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'AdminVouchers harus mengekspor komponen React');
  });

  it('6. Halaman Dashboard Admin (Dashboard.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Dashboard.jsx');
    assert.ok(mod, 'Modul Dashboard harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Dashboard harus mengekspor komponen React');
  });

  it('7. Halaman Profil Admin (Profile.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Profile.jsx');
    assert.ok(mod, 'Modul Profile harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Profile harus mengekspor komponen React');
  });

  it('8. Halaman Buku Panduan (BukuPanduan.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/BukuPanduan.jsx');
    assert.ok(mod, 'Modul BukuPanduan harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'BukuPanduan harus mengekspor komponen React');
  });

  it('9. Komponen AdminDashboard (AdminDashboard.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/components/dashboard/mobile/AdminDashboard.jsx');
    assert.ok(mod, 'Modul AdminDashboard harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'AdminDashboard harus mengekspor komponen React');
  });

  it('10. Roles ADMIN dan SUPER_ADMIN harus terdefinisi dengan benar pada config roles', () => {
    assert.strictEqual(ROLES.ADMIN, 'admin', 'ROLES.ADMIN harus bernilai "admin"');
    assert.strictEqual(ROLES.SUPER_ADMIN, 'super_admin', 'ROLES.SUPER_ADMIN harus bernilai "super_admin"');
  });
});
