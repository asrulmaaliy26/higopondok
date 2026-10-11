import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseActivityTags, getActionBadge } from '../src/lib/activityLogUtils.js';

const API_BASE = 'http://127.0.0.1:8000/api';

describe('Activity Log Frontend Integration API Tests', () => {
  let authToken = '';

  before(async () => {
    // 1. Otentikasi Super Admin untuk mendapatkan token Sanctum
    const loginRes = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@higopondok.id',
        password: 'password',
      }),
    });

    assert.strictEqual(loginRes.status, 200, 'Login Super Admin harus berhasil');
    const loginData = await loginRes.json();
    assert.ok(loginData.access_token, 'Token otentikasi access_token harus tersedia');
    authToken = loginData.access_token;
  });

  it('harus berhasil mengambil daftar log aktivitas audit dengan status 200', async () => {
    const res = await fetch(`${API_BASE}/admin/logs/activity`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
      },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data && Array.isArray(json.data), 'Harus memiliki properti data berupa array');
    assert.ok(json.data.length > 0, 'Daftar log aktivitas tidak boleh kosong');

    const firstLog = json.data[0];
    assert.ok(firstLog.id, 'Log harus memiliki ID');
    assert.ok(firstLog.action, 'Log harus memiliki tipe action');
    assert.ok(firstLog.description, 'Log harus memiliki teks deskripsi');
  });

  it('harus memfilter log berdasarkan parameter search (contoh: "harga")', async () => {
    const res = await fetch(`${API_BASE}/admin/logs/activity?search=harga`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
      },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length > 0, 'Hasil pencarian "harga" harus ditemukan');

    for (const log of json.data) {
      const match = log.description.toLowerCase().includes('harga') ||
                    (log.user && log.user.name.toLowerCase().includes('harga'));
      assert.ok(match, `Log ID ${log.id} harus cocok dengan pencarian kata kunci 'harga'`);

      const tags = parseActivityTags(log.description);
      assert.ok(tags.some(t => t.key === 'price'), 'Tag detail harga harus terdeteksi');
    }
  });

  it('harus memfilter log berdasarkan parameter search kurir (contoh: "kurir")', async () => {
    const res = await fetch(`${API_BASE}/admin/logs/activity?search=kurir`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
      },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length > 0, 'Hasil pencarian "kurir" harus ditemukan');

    for (const log of json.data) {
      const match = log.description.toLowerCase().includes('kurir') ||
                    (log.user && log.user.name.toLowerCase().includes('kurir'));
      assert.ok(match, `Log ID ${log.id} harus memuat konteks 'kurir'`);
    }
  });

  it('harus memfilter log berdasarkan parameter action (contoh: "cancelled")', async () => {
    const res = await fetch(`${API_BASE}/admin/logs/activity?action=cancelled`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
      },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length > 0, 'Harus ada data log dengan status cancelled');

    for (const log of json.data) {
      assert.strictEqual(log.action, 'cancelled', 'Semua log yang difilter harus berstatus cancelled');
      const badge = getActionBadge(log.action);
      assert.strictEqual(badge.label, 'DIBATALKAN');
      const tags = parseActivityTags(log.description);
      assert.ok(tags.some(t => t.key === 'cancel'), 'Tag pembatalan pesanan harus terdeteksi');
    }
  });

});
