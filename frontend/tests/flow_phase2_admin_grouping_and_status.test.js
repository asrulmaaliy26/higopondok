import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper simulasi grouping pesanan wadah di AdminPesanan.jsx
function groupOrdersIntoWadah(orders) {
  const groups = [];
  const map = new Map();

  orders.forEach((order) => {
    const dateKey = order.created_at ? order.created_at.substring(0, 10) : '';
    const key = order.checkout_id
      ? `chk_${order.checkout_id}_${dateKey}`
      : `usr_${order.user_id}_${dateKey || order.id}`;

    if (!map.has(key)) {
      const groupObj = {
        key,
        checkoutId: order.checkout_id || null,
        user: order.user,
        created_at: order.created_at,
        is_priority: order.is_priority || order.order_for === 'guru',
        orders: []
      };
      map.set(key, groupObj);
      groups.push(groupObj);
    }
    map.get(key).orders.push(order);
  });

  return groups;
}

// Helper resolusi status pemesanan wadah (sinkron dengan AdminPesanan.jsx)
function resolveGroupOrderStatus(orders) {
  if (!orders || orders.length === 0) return 'pending';
  const isAllCompleted = orders.every(o => o.status === 'completed');
  const isAllCancelled = orders.every(o => o.status === 'cancelled');
  const isAllProcessing = orders.every(o => o.status === 'processing');
  const isAllPending = orders.every(o => o.status === 'pending');
  const isAnyProcessing = orders.some(o => o.status === 'processing');
  const isAnyCompleted = orders.some(o => o.status === 'completed');

  if (isAllCompleted) return 'completed';
  if (isAllCancelled) return 'cancelled';
  if (isAllProcessing) return 'processing';
  if (isAllPending) return 'pending';
  if (isAnyProcessing || isAnyCompleted) return 'partial_processing';
  return orders[0]?.status || 'pending';
}

// Helper penentuan skor prioritas antrean wadah
function getOrderPriorityScore(order) {
  if (order.status === 'cancelled') return 0;
  if (order.status === 'completed') return 10;
  if (order.status === 'processing') return 70;
  if (order.status === 'pending') {
    if (order.payment_status === 'paid') return 95; // Prioritas tertinggi: Siap diproses
    if (order.payment_status === 'waiting_confirmation') return 90;
    return 80;
  }
  return 50;
}

describe('Frontend Flow Phase 2: Pengelompokan Wadah & Resolusi Status Admin', () => {

  it('harus mengelompokkan pesanan dengan checkout_id dan tanggal yang sama ke dalam 1 wadah', () => {
    const rawOrders = [
      { id: 101, checkout_id: 'CHK-20261016-AAA', created_at: '2026-10-16 09:00:00', user_id: 5, canteen_id: 1, status: 'pending' },
      { id: 102, checkout_id: 'CHK-20261016-AAA', created_at: '2026-10-16 09:00:00', user_id: 5, canteen_id: 2, status: 'pending' },
      { id: 103, checkout_id: 'CHK-20261016-BBB', created_at: '2026-10-16 09:00:00', user_id: 6, canteen_id: 1, status: 'pending' },
    ];

    const wadahList = groupOrdersIntoWadah(rawOrders);
    assert.strictEqual(wadahList.length, 2);
    assert.strictEqual(wadahList[0].orders.length, 2);
    assert.strictEqual(wadahList[1].orders.length, 1);
  });

  it('harus memisahkan wadah jika salah satu toko dijadwalkan ke tanggal berbeda (misal: Besok)', () => {
    const rawOrders = [
      { id: 101, checkout_id: 'CHK-MULTI-DAY', created_at: '2026-10-16 10:00:00', user_id: 5, canteen_id: 1, status: 'pending' },
      { id: 102, checkout_id: 'CHK-MULTI-DAY', created_at: '2026-10-17 10:00:00', user_id: 5, canteen_id: 2, status: 'pending' }, // Dijadwalkan ke besok
    ];

    const wadahList = groupOrdersIntoWadah(rawOrders);
    assert.strictEqual(wadahList.length, 2, 'Harus terbagi menjadi 2 wadah karena perbedaan tanggal pengantaran');
    assert.strictEqual(wadahList[0].orders.length, 1);
    assert.strictEqual(wadahList[1].orders.length, 1);
  });

  it('harus meresolusi groupOrderStatus dengan benar untuk berbagai status toko', () => {
    // 1. Semua toko selesai
    assert.strictEqual(resolveGroupOrderStatus([
      { status: 'completed' },
      { status: 'completed' }
    ]), 'completed');

    // 2. Ada 1 toko sedang proses dan 1 selesai -> Wadah berstatus 'partial_processing'
    assert.strictEqual(resolveGroupOrderStatus([
      { status: 'completed' },
      { status: 'processing' }
    ]), 'partial_processing');

    // 3. Ada 1 toko proses dan 1 toko masih pending -> Wadah berstatus 'partial_processing' (misal: 1/2 Proses)
    assert.strictEqual(resolveGroupOrderStatus([
      { status: 'pending' },
      { status: 'processing' }
    ]), 'partial_processing');

    // 4. Semua sedang diproses
    assert.strictEqual(resolveGroupOrderStatus([
      { status: 'processing' },
      { status: 'processing' }
    ]), 'processing');

    // 5. Semua masih pending -> Wadah berstatus 'pending' (Menunggu)
    assert.strictEqual(resolveGroupOrderStatus([
      { status: 'pending' },
      { status: 'pending' }
    ]), 'pending');

    // 6. Semua dibatalkan -> Wadah berstatus 'cancelled'
    assert.strictEqual(resolveGroupOrderStatus([
      { status: 'cancelled' },
      { status: 'cancelled' }
    ]), 'cancelled');
  });

  it('harus memprioritaskan pesanan lunas yang masih pending di urutan teratas (skor 95)', () => {
    const pendingPaidOrder = { status: 'pending', payment_status: 'paid' };
    const pendingUnpaidOrder = { status: 'pending', payment_status: 'unpaid' };
    const processingOrder = { status: 'processing', payment_status: 'paid' };
    const completedOrder = { status: 'completed', payment_status: 'paid' };

    assert.strictEqual(getOrderPriorityScore(pendingPaidOrder), 95);
    assert.strictEqual(getOrderPriorityScore(pendingUnpaidOrder), 80);
    assert.strictEqual(getOrderPriorityScore(processingOrder), 70);
    assert.strictEqual(getOrderPriorityScore(completedOrder), 10);
    assert.ok(getOrderPriorityScore(pendingPaidOrder) > getOrderPriorityScore(pendingUnpaidOrder));
  });
});
