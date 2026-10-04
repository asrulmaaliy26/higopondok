import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { ROLES, getUserRole } from '../config/roles';

export function useSyncStatus(user) {
  const role = getUserRole(user);
  const isAdmin = role === ROLES.ADMIN;

  return useQuery({
    queryKey: ['db_sync_status'],
    queryFn: async () => {
      const res = await api.get('/db-sync/status');
      return res.data;
    },
    enabled: !!isAdmin,
    staleTime: 1000 * 60 * 10, // 10 menit
  });
}

export function usePullDatabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Tampilkan custom UI di modal, hindari global fullscreen spinner yang mengganggu
      const res = await api.post('/db-sync/pull', {}, { showLoading: false });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      toast.success(data?.message || 'Database lokal berhasil disinkronkan!');
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error?.message || 'Gagal menyinkronkan database dari VPS.';
      toast.error(msg);
    }
  });
}
