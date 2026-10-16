import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper simulasi filtering antrean kurir di TugasKurir.jsx
function filterCourierOrders(orders, currentUserId, {
  statusTab = 'processing',
  recipientFilter = 'all',
  selectedCanteenFilter = 'all',
  searchQuery = ''
} = {}) {
  return orders.filter(order => {
    // 1. Status / Tab Filter
    if (statusTab === 'my_tasks') {
      if (order.courier_id !== currentUserId) return false;
    } else if (statusTab === 'pending') {
      if (order.status !== 'pending') return false;
    } else if (statusTab === 'processing') {
      if (order.status !== 'processing') return false;
    } else if (statusTab === 'completed') {
      if (order.status !== 'completed') return false;
    }

    // 2. Recipient Type Filter (Guru vs Santri)
    const isTeacher = order.is_priority || order.order_for === 'guru' || order.user?.is_teacher;
    if (recipientFilter === 'guru' && !isTeacher) return false;
    if (recipientFilter === 'santri' && isTeacher) return false;

    // 3. Canteen Filter
    if (selectedCanteenFilter !== 'all') {
      if (order.canteen_id?.toString() !== selectedCanteenFilter.toString()) return false;
    }

    // 4. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesId = order.id?.toString().includes(q);
      const matchesSantri = (order.recipient_santri_name || order.user?.santri_name)?.toLowerCase().includes(q);
      if (!matchesId && !matchesSantri) return false;
    }

    return true;
  });
}

describe('Frontend Flow Phase 3: Antrean Tugas & Filter Kurir', () => {

  const dummyOrders = [
    {
      id: 201,
      canteen_id: 1,
      courier_id: 10,
      status: 'processing',
      order_for: 'santri',
      recipient_santri_name: 'Zaid Santri',
      user: { name: 'Wali Zaid', santri_name: 'Zaid Santri' }
    },
    {
      id: 202,
      canteen_id: 1,
      courier_id: 10,
      status: 'pending',
      order_for: 'santri',
      recipient_santri_name: 'Umar Santri',
      user: { name: 'Wali Umar', santri_name: 'Umar Santri' }
    },
    {
      id: 203,
      canteen_id: 2,
      courier_id: 10,
      status: 'processing',
      order_for: 'guru',
      is_priority: true,
      recipient_santri_name: 'Ustadz Mansur',
      user: { name: 'Ustadz Mansur', is_teacher: true }
    },
    {
      id: 204,
      canteen_id: 1,
      courier_id: 99, // Kurir lain
      status: 'processing',
      order_for: 'santri',
      recipient_santri_name: 'Ali Santri',
      user: { name: 'Wali Ali', santri_name: 'Ali Santri' }
    },
    {
      id: 205,
      canteen_id: 1,
      courier_id: 10,
      status: 'completed',
      order_for: 'santri',
      recipient_santri_name: 'Fatih Santri',
      user: { name: 'Wali Fatih', santri_name: 'Fatih Santri' }
    }
  ];

  it('secara default (tab processing) hanya menampilkan pesanan yang sedang diproses / diantar', () => {
    const res = filterCourierOrders(dummyOrders, 10, { statusTab: 'processing' });
    assert.strictEqual(res.length, 3);
    assert.ok(res.every(o => o.status === 'processing'));
  });

  it('pada tab my_tasks hanya menampilkan tugas milik kurir saat ini (currentUserId = 10)', () => {
    const res = filterCourierOrders(dummyOrders, 10, { statusTab: 'my_tasks' });
    // Kurir 10 memiliki id 201, 202, 203, 205 (id 204 milik kurir 99)
    assert.strictEqual(res.length, 4);
    assert.ok(res.every(o => o.courier_id === 10));
    assert.ok(!res.some(o => o.id === 204));
  });

  it('dapat memfilter pesanan khusus Guru / Staff Yayasan', () => {
    const res = filterCourierOrders(dummyOrders, 10, {
      statusTab: 'processing',
      recipientFilter: 'guru'
    });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, 203);
    assert.strictEqual(res[0].recipient_santri_name, 'Ustadz Mansur');
  });

  it('dapat mencari pesanan berdasarkan kata kunci nama santri', () => {
    const res = filterCourierOrders(dummyOrders, 10, {
      statusTab: 'processing',
      searchQuery: 'Zaid'
    });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, 201);
  });
});
