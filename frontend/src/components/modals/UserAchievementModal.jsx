import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Crown, 
  Award, 
  Sparkles, 
  Medal, 
  Star, 
  User, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  Phone, 
  MessageCircle,
  ExternalLink,
  Building2,
  Calendar
} from 'lucide-react';
import api from '../../lib/axios';
import LoadingSpinner from '../common/LoadingSpinner';

const formatRupiah = (num) => {
  return Math.round(Number(num) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export default function UserAchievementModal({ userId, isOpen, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin_user_achievement', userId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${userId}/achievements`);
      return res.data;
    },
    enabled: Boolean(isOpen && userId),
    staleTime: 1000 * 60 * 5
  });

  if (!isOpen) return null;

  const user = data?.user;
  const achievement = data?.achievement;
  const santris = data?.santris || [];
  const totalOrders = data?.total_orders || 0;
  const totalSpent = data?.total_spent || 0;
  const santriCount = data?.santri_count || 0;

  const renderTierIcon = (tier) => {
    switch (tier) {
      case 'Sultan':
        return <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'Platinum':
        return <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'Gold':
        return <Medal className="w-5 h-5 text-amber-500" />;
      case 'Silver':
        return <Star className="w-5 h-5 text-blue-500" />;
      default:
        return <Award className="w-5 h-5 text-gray-500" />;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-none shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-none bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-300 dark:border-purple-800 shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                Prestasi & Riwayat Pemesan (Fokus Akun Wali)
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Statistik akumulasi pemesanan & daftar santri yang pernah dibelanjakan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-none bg-gray-200/80 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors border border-gray-300 dark:border-gray-600 cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3.5 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <LoadingSpinner size="md" />
              <span className="text-xs text-gray-500 font-medium">Memuat data prestasi pemesan...</span>
            </div>
          ) : isError || !user ? (
            <div className="py-8 text-center text-xs text-red-600 dark:text-red-400">
              Gagal memuat data prestasi pemesan. Silakan coba beberapa saat lagi.
            </div>
          ) : (
            <>
              {/* 1. KARTU IDENTITAS WALI & BADGE PRESTASI */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-none space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        Akun Pemesan / Wali:
                      </span>
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-none bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 uppercase">
                        ID #{user.id}
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase mt-0.5">
                      👤 {user.name}
                    </h2>
                    {user.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mt-1">
                        <Phone className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="font-mono font-semibold">{user.phone}</span>
                        <a
                          href={`https://wa.me/${user.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-bold cursor-pointer"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Chat WA</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* BADGE PRESTASI BESAR */}
                  {achievement && (
                    <div className={`p-2.5 rounded-none border flex items-center gap-2.5 shrink-0 ${achievement.cls}`}>
                      <div className="p-1.5 bg-white dark:bg-gray-900 rounded-none border border-current shrink-0">
                        {renderTierIcon(achievement.tier)}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wide">
                          {achievement.badge}
                        </div>
                        <p className="text-[10px] opacity-90 font-medium">
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* GRID METRIK PRESTASI */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200 dark:border-gray-700 text-center">
                  <div className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none">
                    <span className="text-[9.5px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
                      Total Pesanan
                    </span>
                    <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white font-mono">
                      {totalOrders}x
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none">
                    <span className="text-[9.5px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
                      Santri Dipesankan
                    </span>
                    <span className="text-sm sm:text-base font-black text-green-700 dark:text-green-400 font-mono">
                      {santriCount} Santri
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none">
                    <span className="text-[9.5px] text-gray-500 dark:text-gray-400 block uppercase font-bold">
                      Total Belanja
                    </span>
                    <span className="text-sm sm:text-base font-black text-purple-700 dark:text-purple-400 font-mono">
                      Rp {formatRupiah(totalSpent)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. TABEL SANTRI YANG PERNAH DIPESANKAN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    <span>Daftar Santri yang Pernah Dipesankan ({santriCount} Santri)</span>
                  </h4>
                  <span className="text-[10px] text-gray-500">
                    Diurutkan dari transaksi terbesar
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-none">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 px-2 text-center w-[35px] border-r border-gray-200 dark:border-gray-700">No</th>
                        <th className="py-2 px-2.5 border-r border-gray-200 dark:border-gray-700 min-w-[140px]">Nama Santri & Kamar</th>
                        <th className="py-2 px-2 border-r border-gray-200 dark:border-gray-700 w-[90px]">Kelas</th>
                        <th className="py-2 px-2 border-r border-gray-200 dark:border-gray-700 text-center w-[60px]">Pesanan</th>
                        <th className="py-2 px-2.5 border-r border-gray-200 dark:border-gray-700 text-right w-[110px]">Total Belanja</th>
                        <th className="py-2 px-2 text-center w-[90px]">Terakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-[11px]">
                      {santris.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-6 text-center text-gray-500 font-semibold">
                            Belum ada santri yang pernah dipesankan oleh akun ini.
                          </td>
                        </tr>
                      ) : (
                        santris.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 px-2 text-center text-gray-500 font-bold border-r border-gray-200 dark:border-gray-700">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2.5 border-r border-gray-200 dark:border-gray-700">
                              <span className="font-bold text-gray-900 dark:text-white block uppercase leading-tight">
                                {s.name}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 font-medium leading-tight">
                                📍 {s.room || '-'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300 font-medium border-r border-gray-200 dark:border-gray-700">
                              {s.class || '-'}
                            </td>
                            <td className="py-2 px-2 text-center border-r border-gray-200 dark:border-gray-700 font-mono font-bold text-gray-900 dark:text-white">
                              {s.order_count}x
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-green-700 dark:text-green-400 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                              Rp {formatRupiah(s.total_spent)}
                            </td>
                            <td className="py-2 px-2 text-center text-[10px] text-gray-500 font-mono whitespace-nowrap">
                              {formatDate(s.last_order_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-gray-800 hover:bg-black text-white dark:bg-gray-700 dark:hover:bg-gray-600 rounded-none font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

