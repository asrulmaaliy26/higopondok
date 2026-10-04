import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { getUserRole, ROLES } from '../../config/roles';
import { Shield, ArrowLeft, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';

export default function ImpersonationBanner() {
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const user = useAuthStore((state) => state.user);
  const stopImpersonating = useAuthStore((state) => state.stopImpersonating);
  const queryClient = useQueryClient();

  if (!originalAdmin) return null;

  const role = getUserRole(user) || 'user';

  const getRoleLabel = (r) => {
    switch (r) {
      case ROLES.KANTIN:
        return 'Kantin';
      case ROLES.KURIR:
        return 'Kurir';
      case ROLES.USER:
        return 'Santri / Wali';
      default:
        return r;
    }
  };

  const handleReturnToAdmin = async () => {
    try {
      await api.post('/logout');
    } catch (e) {
      console.error('Gagal membatalkan token penyamaran di server:', e);
    }
    // Bersihkan cache query agar data target user tidak tercampur ke akun admin
    queryClient.clear();
    stopImpersonating();
    window.location.href = '/dashboard/users';
  };

  return (
    <div className="bg-amber-500 text-gray-950 px-3 py-1.5 sm:px-4 sm:py-2 border-b border-amber-600 shadow-md sticky top-0 z-[9999] flex items-center justify-between gap-2 text-xs font-semibold">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <span className="p-1 bg-amber-600/30 rounded-none shrink-0">
          <Shield className="w-3.5 h-3.5 text-gray-950" />
        </span>
        <div className="truncate text-[11px] sm:text-xs text-gray-950 leading-tight">
          <span>Menyamar sebagai: </span>
          <strong className="font-extrabold underline">{user?.name || 'Pengguna'}</strong>
          <span className="ml-1.5 px-1.5 py-0.2 bg-amber-900 text-amber-100 text-[10px] font-black uppercase rounded-none inline-block">
            {getRoleLabel(role)}
          </span>
        </div>
      </div>

      <button
        onClick={handleReturnToAdmin}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-gray-950 hover:bg-gray-800 text-amber-300 active:scale-95 text-[11px] font-extrabold rounded-none shadow-xs border border-gray-900 transition-all cursor-pointer"
        title="Kembali ke Dashboard Admin"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Kembali ke Admin</span>
        <span className="xs:hidden">Kembali</span>
      </button>
    </div>
  );
}
