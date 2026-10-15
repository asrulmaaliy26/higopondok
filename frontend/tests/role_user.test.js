import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, closeViteServer } from './loadComponent.js';
import { ROLES } from '../src/config/roles.js';

describe('Unit Test: Role USER (Santri / Wali) Pages', () => {
  after(async () => {
    await closeViteServer();
  });

  it('1. Halaman Beranda (Home.jsx) harus termuat dan tervalidasi tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Home.jsx');
    assert.ok(mod, 'Modul Home harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Home harus mengekspor komponen React');
  });

  it('2. Halaman Daftar Kantin & Toko (Kantin.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Kantin.jsx');
    assert.ok(mod, 'Modul Kantin harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Kantin harus mengekspor komponen React');
  });

  it('3. Halaman Detail Menu Kantin (DetailKantin.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/DetailKantin.jsx');
    assert.ok(mod, 'Modul DetailKantin harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'DetailKantin harus mengekspor komponen React');
  });

  it('4. Halaman Keranjang Belanja (Keranjang.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Keranjang.jsx');
    assert.ok(mod, 'Modul Keranjang harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Keranjang harus mengekspor komponen React');
  });

  it('5. Halaman Pembayaran Santri (Pembayaran.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Pembayaran.jsx');
    assert.ok(mod, 'Modul Pembayaran harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Pembayaran harus mengekspor komponen React');
  });

  it('6. Halaman Voucher Diskon (Vouchers.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Vouchers.jsx');
    assert.ok(mod, 'Modul Vouchers harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Vouchers harus mengekspor komponen React');
  });

  it('7. Halaman Profil Pengguna (Profile.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Profile.jsx');
    assert.ok(mod, 'Modul Profile harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Profile harus mengekspor komponen React');
  });

  it('8. Halaman Buku Panduan (BukuPanduan.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/BukuPanduan.jsx');
    assert.ok(mod, 'Modul BukuPanduan harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'BukuPanduan harus mengekspor komponen React');
  });

  it('9. Role USER harus terdefinisi dengan benar pada config roles', () => {
    assert.strictEqual(ROLES.USER, 'user', 'ROLES.USER harus bernilai "user"');
  });
});
