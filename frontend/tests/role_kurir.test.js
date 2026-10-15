import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, closeViteServer } from './loadComponent.js';
import { ROLES } from '../src/config/roles.js';

describe('Unit Test: Role KURIR (Driver) Pages', () => {
  after(async () => {
    await closeViteServer();
  });

  it('1. Halaman Tugas Kurir (TugasKurir.jsx) harus termuat tanpa ReferenceError (mencegah error santriData)', async () => {
    const mod = await loadComponent('./src/pages/mobile/TugasKurir.jsx');
    assert.ok(mod, 'Modul TugasKurir harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'TugasKurir harus mengekspor komponen React');
  });

  it('2. Halaman Dashboard Kurir (Dashboard.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Dashboard.jsx');
    assert.ok(mod, 'Modul Dashboard harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Dashboard harus mengekspor komponen React');
  });

  it('3. Halaman Profil Kurir (Profile.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Profile.jsx');
    assert.ok(mod, 'Modul Profile harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Profile harus mengekspor komponen React');
  });

  it('4. Halaman Panduan Kurir (BukuPanduan.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/BukuPanduan.jsx');
    assert.ok(mod, 'Modul BukuPanduan harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'BukuPanduan harus mengekspor komponen React');
  });

  it('5. Role KURIR harus terdefinisi dengan benar pada config roles', () => {
    assert.strictEqual(ROLES.KURIR, 'kurir', 'ROLES.KURIR harus bernilai "kurir"');
  });
});
