import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, closeViteServer } from './loadComponent.js';
import { ROLES } from '../src/config/roles.js';

describe('Unit Test: Role KANTIN (Mitra Toko) Pages', () => {
  after(async () => {
    await closeViteServer();
  });

  it('1. Halaman Pesanan Toko (PesananToko.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/PesananToko.jsx');
    assert.ok(mod, 'Modul PesananToko harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'PesananToko harus mengekspor komponen React');
  });

  it('2. Halaman Toko Saya / Manajemen Produk (TokoSaya.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/TokoSaya.jsx');
    assert.ok(mod, 'Modul TokoSaya harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'TokoSaya harus mengekspor komponen React');
  });

  it('3. Halaman Promo Voucher Toko (PromoVoucher.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/PromoVoucher.jsx');
    assert.ok(mod, 'Modul PromoVoucher harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'PromoVoucher harus mengekspor komponen React');
  });

  it('4. Halaman Profil Mitra Toko (Profile.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/Profile.jsx');
    assert.ok(mod, 'Modul Profile harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'Profile harus mengekspor komponen React');
  });

  it('5. Halaman Buku Panduan Mitra (BukuPanduan.jsx) harus termuat tanpa error runtime', async () => {
    const mod = await loadComponent('./src/pages/mobile/BukuPanduan.jsx');
    assert.ok(mod, 'Modul BukuPanduan harus berhasil dimuat');
    assert.strictEqual(typeof mod.default, 'function', 'BukuPanduan harus mengekspor komponen React');
  });

  it('6. Role KANTIN harus terdefinisi dengan benar pada config roles', () => {
    assert.strictEqual(ROLES.KANTIN, 'kantin', 'ROLES.KANTIN harus bernilai "kantin"');
  });
});
