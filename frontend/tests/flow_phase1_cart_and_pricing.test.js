import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper fungsi simulasi kalkulasi keranjang & checkout frontend
function calculateItemSubtotal(item) {
  const basePrice = parseFloat(item.price || 0);
  const optionsPrice = (item.selectedOptions || []).reduce((sum, opt) => sum + parseFloat(opt.price || 0), 0);
  return (basePrice + optionsPrice) * parseInt(item.quantity || 1, 10);
}

function calculateStoreTotals(items, storeDeliveryFee = 3000, storeAdminFee = 1000) {
  const productsSubtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  const totalItemsCount = items.reduce((sum, item) => sum + parseInt(item.quantity || 1, 10), 0);
  const totalGrand = productsSubtotal + storeDeliveryFee + storeAdminFee;
  return {
    productsSubtotal,
    totalItemsCount,
    deliveryFee: storeDeliveryFee,
    adminFee: storeAdminFee,
    grandTotal: totalGrand,
  };
}

describe('Frontend Flow Phase 1: Keranjang & Kalkulasi Checkout', () => {

  it('harus menghitung subtotal produk dengan varian opsi tambahan', () => {
    const item = {
      id: 1,
      name: 'Nasi Goreng Spesial',
      price: 15000,
      quantity: 2,
      selectedOptions: [
        { name: 'Tambah Telur Ceplok', price: 3000 },
        { name: 'Level Pedas 3', price: 0 }
      ]
    };
    // (15.000 + 3.000 + 0) * 2 = 36.000
    const subtotal = calculateItemSubtotal(item);
    assert.strictEqual(subtotal, 36000);
  });

  it('harus mengagregasi total toko (produk + ongkir + admin) dengan benar', () => {
    const items = [
      { id: 1, name: 'Ayam Geprek', price: 15000, quantity: 2, selectedOptions: [] },
      { id: 2, name: 'Es Teh Manis', price: 5000, quantity: 1, selectedOptions: [] },
    ];
    // Produk: (15.000 * 2) + (5.000 * 1) = 35.000
    // Ongkir: 3.000, Admin: 1.000 -> Grand Total: 39.000
    const res = calculateStoreTotals(items, 3000, 1000);
    assert.strictEqual(res.productsSubtotal, 35000);
    assert.strictEqual(res.totalItemsCount, 3);
    assert.strictEqual(res.deliveryFee, 3000);
    assert.strictEqual(res.adminFee, 1000);
    assert.strictEqual(res.grandTotal, 39000);
  });

  it('harus memformat payload multi-toko (batch checkout) sesuai schema backend', () => {
    const cartState = {
      canteen_1: [
        { product_id: 101, quantity: 1, notes: 'Pedas' }
      ],
      canteen_2: [
        { product_id: 202, quantity: 2, notes: 'Dingin' }
      ]
    };

    const canteensPayload = Object.entries(cartState).map(([key, items]) => ({
      canteen_id: parseInt(key.replace('canteen_', ''), 10),
      items: items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        notes: i.notes || null,
      }))
    }));

    assert.strictEqual(canteensPayload.length, 2);
    assert.strictEqual(canteensPayload[0].canteen_id, 1);
    assert.strictEqual(canteensPayload[1].canteen_id, 2);
    assert.strictEqual(canteensPayload[1].items[0].quantity, 2);
  });

  it('harus memvalidasi kelengkapan profil pengguna di checkout tanpa keluar dari keranjang', () => {
    // Fungsi validator profil checkout
    const validateCheckoutProfile = (user, orderFor) => {
      if (!user) return { canCheckout: false, requireLogin: true };
      if (user.is_teacher && orderFor === 'guru') {
        const isValid = Boolean(user.phone && user.niy && user.teacher_unit);
        return { canCheckout: isValid, showProfileModal: !isValid };
      }
      const isValid = Boolean(user.phone && user.santri_name && user.santri_room && user.santri_class && user.santri_level);
      return { canCheckout: isValid, showProfileModal: !isValid };
    };

    // Kasus 1: User belum lengkap santri dan no wa -> harus memicu modal popup, bukan redirect
    const incompleteUser = { name: 'Wali Santri Baru', phone: null, santri_name: null };
    const res1 = validateCheckoutProfile(incompleteUser, 'santri');
    assert.strictEqual(res1.canCheckout, false);
    assert.strictEqual(res1.showProfileModal, true);

    // Kasus 2: User santri sudah lengkap
    const completeUser = {
      name: 'Wali Santri Ahmad',
      phone: '6281234567890',
      santri_name: 'Ahmad Fauzan',
      santri_room: 'Asrama Abu Bakar 02',
      santri_class: '7A',
      santri_level: 'SMP'
    };
    const res2 = validateCheckoutProfile(completeUser, 'santri');
    assert.strictEqual(res2.canCheckout, true);
    assert.strictEqual(res2.showProfileModal, false);

    // Kasus 3: Guru memesan untuk diri sendiri
    const teacherUser = {
      name: 'Ustadz Fauzi',
      phone: '6289988776655',
      is_teacher: true,
      niy: 'NIY. 1985.03.099',
      teacher_unit: 'SMP'
    };
    const res3 = validateCheckoutProfile(teacherUser, 'guru');
    assert.strictEqual(res3.canCheckout, true);
    assert.strictEqual(res3.showProfileModal, false);
  });

  it('harus membersihkan dan menstandarisasi format nomor WhatsApp Indonesia (62xxx)', () => {
    const sanitizePhone = (input) => {
      let p = (input || '').trim().replace(/\D/g, '');
      if (p.startsWith('62')) p = p.substring(2);
      if (p.startsWith('0')) p = p.substring(1);
      if (!p || p.length < 8) return null;
      return '62' + p;
    };

    assert.strictEqual(sanitizePhone('0812-3456-7890'), '6281234567890');
    assert.strictEqual(sanitizePhone('+62 812 3456 7890'), '6281234567890');
    assert.strictEqual(sanitizePhone('6281234567890'), '6281234567890');
    assert.strictEqual(sanitizePhone('81234567890'), '6281234567890');
    assert.strictEqual(sanitizePhone('123'), null); // nomor terlalu pendek
  });

  it('harus memprioritaskan snapshot penerima spesifik pesanan (recipient_santri_name) agar pesanan lama tidak terpengaruh saat profil berganti', () => {
    // Fungsi resolusi penerima pesanan yang digunakan di antarmuka Kurir, Admin, Toko, dan Santri
    const resolveOrderRecipient = (order, currentUser) => {
      const isTeacherOrder = order.order_for === 'guru' || (order.user?.is_teacher && order.order_for !== 'santri');
      const santriName = isTeacherOrder
        ? (order.user?.name || 'Guru / Staff')
        : (order.recipient_santri_name || order.user?.santri_name || order.user?.name || '-');
      const santriRoom = isTeacherOrder
        ? (order.delivery_location || `Ruang Guru ${order.user?.teacher_unit || ''}`)
        : (order.recipient_santri_room || order.delivery_location || order.user?.santri_room || '-');
      return { santriName, santriRoom };
    };

    // Keadaan User saat ini (sudah berganti ke Santri Kedua: Zaid)
    const currentUser = {
      id: 99,
      name: 'Wali Santri Budi',
      santri_name: 'Zaid Santri Kedua',
      santri_room: 'Kamar Utsman 04'
    };

    // Pesanan Lama (Order 1) yang dipesan sebelumnya untuk Santri Pertama (Ahmad)
    const oldOrder = {
      id: 101,
      order_for: 'santri',
      recipient_santri_name: 'Ahmad Santri Pertama',
      recipient_santri_room: 'Kamar Abu Bakar 01',
      delivery_location: 'Kamar Abu Bakar 01',
      user: currentUser // relasi user mengarah ke objek user yang saat ini profilnya sudah Zaid
    };

    // Pesanan Baru (Order 2) yang dipesan untuk Santri Kedua (Zaid)
    const newOrder = {
      id: 102,
      order_for: 'santri',
      recipient_santri_name: 'Zaid Santri Kedua',
      recipient_santri_room: 'Kamar Utsman 04',
      delivery_location: 'Kamar Utsman 04',
      user: currentUser
    };

    const recipientOld = resolveOrderRecipient(oldOrder, currentUser);
    const recipientNew = resolveOrderRecipient(newOrder, currentUser);

    // Verifikasi Pesanan Lama tetap mengarah ke Ahmad di Kamar Abu Bakar 01
    assert.strictEqual(recipientOld.santriName, 'Ahmad Santri Pertama');
    assert.strictEqual(recipientOld.santriRoom, 'Kamar Abu Bakar 01');

    // Verifikasi Pesanan Baru mengarah ke Zaid di Kamar Utsman 04
    assert.strictEqual(recipientNew.santriName, 'Zaid Santri Kedua');
    assert.strictEqual(recipientNew.santriRoom, 'Kamar Utsman 04');
  });
});

