import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  parseActivityTags, 
  getActionBadge, 
  getModelBadge, 
  getRoleBadge 
} from '../src/lib/activityLogUtils.js';

describe('Activity Log Frontend Utility Tests', () => {

  describe('parseActivityTags() - Deteksi Keyword Spesifik Perubahan', () => {
    it('harus mendeteksi perubahan harga jual & harga modal (HPP)', () => {
      const desc = "Memperbarui menu 'Nasi Goreng': Ubah harga jual dari Rp 15.000 menjadi Rp 18.000, ubah harga modal (HPP) dari Rp 10.000 menjadi Rp 12.000";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'price' && t.label === 'Perubahan Harga'));
    });

    it('harus mendeteksi perubahan kategori produk', () => {
      const desc = "Memperbarui menu 'Es Teh Jumbo': Ubah kategori dari 'Minuman' menjadi 'Minuman Dingin Favorit'";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'category' && t.label === 'Kategori'));
    });

    it('harus mendeteksi unggah/ganti foto produk', () => {
      const desc = "Memperbarui menu 'Ayam Penyet': Unggah foto menu baru";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'image' && t.label === 'Upload Foto'));
    });

    it('harus mendeteksi perubahan stok barang/ketersediaan', () => {
      const desc = "Memperbarui menu 'Roti Bakar': Ubah stok dari 10 menjadi 0 (Status: Stok Habis)";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'stock' && t.label === 'Stok Menu'));
    });

    it('harus mendeteksi pembatalan pesanan', () => {
      const desc = "Membatalkan pesanan #1042 (Alasan: Santri membatalkan pesanan karena salah varian)";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'cancel' && t.label === 'Pembatalan Pesanan'));
    });

    it('harus mendeteksi penugasan atau perpindahan kurir', () => {
      const desc = "Memperbarui pesanan #1045: Pindah kurir pengantar dari 'Ahmad Kurir' ke 'Budi Kurir'";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'courier' && t.label === 'Tugas / Pindah Kurir'));
    });

    it('harus mendeteksi kombinasi banyak perubahan sekaligus dalam satu aktivitas', () => {
      const desc = "Memperbarui menu: Ubah harga jual Rp 10.000, ubah kategori Minuman, unggah foto baru, ubah opsi varian pedas";
      const tags = parseActivityTags(desc);
      assert.ok(tags.some(t => t.key === 'price'));
      assert.ok(tags.some(t => t.key === 'category'));
      assert.ok(tags.some(t => t.key === 'image'));
      assert.ok(tags.some(t => t.key === 'variant'));
      assert.strictEqual(tags.length, 4);
    });

    it('mengembalikan array kosong jika deskripsi tidak memuat kata kunci', () => {
      const desc = "Melihat halaman laporan bulanan";
      const tags = parseActivityTags(desc);
      assert.deepStrictEqual(tags, []);
    });
  });

  describe('getActionBadge() - Klasifikasi Badge Aksi', () => {
    it('mengembalikan badge TAMBAH untuk created', () => {
      const badge = getActionBadge('created');
      assert.strictEqual(badge.label, 'TAMBAH');
    });

    it('mengembalikan badge EDIT / UBAH untuk updated', () => {
      const badge = getActionBadge('updated');
      assert.strictEqual(badge.label, 'EDIT / UBAH');
    });

    it('mengembalikan badge HAPUS untuk deleted', () => {
      const badge = getActionBadge('deleted');
      assert.strictEqual(badge.label, 'HAPUS');
    });

    it('mengembalikan badge DIBATALKAN untuk cancelled', () => {
      const badge = getActionBadge('cancelled');
      assert.strictEqual(badge.label, 'DIBATALKAN');
    });
  });

  describe('getModelBadge() - Klasifikasi Model Entitas', () => {
    it('mengembalikan MENU untuk Product', () => {
      const badge = getModelBadge('Product');
      assert.strictEqual(badge.label, 'MENU');
      assert.strictEqual(badge.type, 'product');
    });

    it('mengembalikan TOKO/KANTIN untuk Canteen', () => {
      const badge = getModelBadge('Canteen');
      assert.strictEqual(badge.label, 'TOKO/KANTIN');
      assert.strictEqual(badge.type, 'canteen');
    });

    it('mengembalikan PESANAN untuk Order', () => {
      const badge = getModelBadge('Order');
      assert.strictEqual(badge.label, 'PESANAN');
      assert.strictEqual(badge.type, 'order');
    });

    it('mengembalikan PENGGUNA untuk User', () => {
      const badge = getModelBadge('User');
      assert.strictEqual(badge.label, 'PENGGUNA');
      assert.strictEqual(badge.type, 'user');
    });
  });

  describe('getRoleBadge() - Format Role Pengguna', () => {
    it('mengidentifikasi Super Admin', () => {
      const badge = getRoleBadge([{ name: 'super_admin' }]);
      assert.strictEqual(badge.label, 'Super Admin');
    });

    it('mengidentifikasi Mitra Kantin', () => {
      const badge = getRoleBadge([{ name: 'kantin' }]);
      assert.strictEqual(badge.label, 'Mitra Kantin');
    });

    it('mengidentifikasi Kurir', () => {
      const badge = getRoleBadge([{ name: 'kurir' }]);
      assert.strictEqual(badge.label, 'Kurir');
    });
  });

});
