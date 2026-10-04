import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { getUserRole, ROLES } from '../config/roles';

/**
 * Hook untuk menghitung jumlah pesanan yang sedang diproses / aktif (belum selesai & belum batal)
 * Digunakan untuk menampilkan badge notifikasi di menu Pesanan (Kantin & Admin), Tugas (Kurir), dan Riwayat (User).
 */
export function useActiveOrdersCount() {
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const role = getUserRole(user) || (originalAdmin ? 'user' : 'admin');

  // 1. Query Kantin: Menggunakan key sinkron dengan PesananToko
  const { data: canteenOrdersRes } = useQuery({
    queryKey: ['canteen_orders', 'all', '', ''],
    queryFn: async () => {
      const res = await api.get('/canteen/orders?canteen_id=all&start_date=&end_date=');
      return res.data;
    },
    enabled: role === ROLES.KANTIN,
    refetchInterval: 5000,
  });

  // 2. Query Admin
  const { data: adminOrdersRes } = useQuery({
    queryKey: ['admin_orders_active_badge'],
    queryFn: async () => {
      const res = await api.get('/admin/orders');
      return res.data;
    },
    enabled: role === ROLES.ADMIN,
    refetchInterval: 8000,
  });

  // 3. Query Kurir
  const { data: courierOrdersRes } = useQuery({
    queryKey: ['courier_orders'],
    queryFn: async () => {
      const res = await api.get('/courier/orders');
      return res.data;
    },
    enabled: role === ROLES.KURIR,
    refetchInterval: 5000,
  });

  // 4. Query User (Wali / Santri)
  const { data: userOrdersRes } = useQuery({
    queryKey: ['user_orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    enabled: role === ROLES.USER,
    refetchInterval: 5000,
  });

  if (role === ROLES.KANTIN) {
    const list = Array.isArray(canteenOrdersRes)
      ? canteenOrdersRes
      : canteenOrdersRes?.data || [];
    return list.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  }

  if (role === ROLES.ADMIN) {
    const list = Array.isArray(adminOrdersRes)
      ? adminOrdersRes
      : adminOrdersRes?.data || [];
    return list.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  }

  if (role === ROLES.KURIR) {
    const list = Array.isArray(courierOrdersRes)
      ? courierOrdersRes
      : courierOrdersRes?.data || [];
    return list.filter((o) => o.status === 'processing').length;
  }

  if (role === ROLES.USER) {
    const list = Array.isArray(userOrdersRes)
      ? userOrdersRes
      : userOrdersRes?.data || [];
    return list.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  }

  return 0;
}
