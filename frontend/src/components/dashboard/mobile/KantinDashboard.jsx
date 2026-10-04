import React from 'react';
import { ShoppingBag, Wallet, TrendingUp, Store, ChevronRight, Activity, Calendar, History, Clock, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/axios';
import { useCanteenStore } from '../../../store/canteenStore';
import { useNavigate } from '@tanstack/react-router';
import AppImage from '../../common/AppImage';

export default function KantinDashboard({ user }) {
  const navigate = useNavigate();
  const { setActiveCanteenId, setIsStoreSelected } = useCanteenStore();

  // Fetch Global Analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['my_canteens_analytics'],
    queryFn: async () => {
      const res = await api.get('/my-canteens/analytics');
      return res.data;
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  const handleSelectStore = (storeId) => {
    setActiveCanteenId(storeId);
    setIsStoreSelected(true);
    navigate({ to: '/dashboard/toko-saya/pesanan' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  return (
    <div className="space-y-2.5 pb-20 animate-fade-in-up font-sans">
      {/* Header & Global Balance (GoBiz Merchant Wallet Style) */}
      <div className="bg-gradient-to-r from-emerald-950 via-green-900 to-teal-950 rounded-none p-3 sm:p-4 text-white shadow-md border border-green-500/30 relative overflow-hidden">
        {/* Subtle glowing ambient orbs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-green-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-green-400 animate-pulse"></span>
              <span className="text-[10px] sm:text-xs text-green-200/90 uppercase font-black tracking-widest">
                Saldo Aktif Merchant
              </span>
            </div>
            <button 
              onClick={() => navigate({ to: '/dashboard/toko-saya/pesanan' })}
              className="text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-none border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Kelola Pesanan</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight leading-none">
              {formatRupiah(analytics?.total_balance)}
            </h2>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-green-100/80">Pesanan Selesai:</span>
                <span className="font-bold font-mono text-white">{analytics?.completed_orders_count || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-green-100/80">Outlet:</span>
                <span className="font-bold font-mono text-white">{analytics?.store_performance?.length || 0}</span>
              </div>
            </div>

            <button 
              onClick={() => navigate({ to: '/dashboard/toko-saya' })}
              className="text-[11px] font-bold text-emerald-300 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>Toko Saya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Banner Jika Belum Memiliki Toko */}
      {(!analytics?.store_performance || analytics.store_performance.length === 0) && (
        <div className="bg-white dark:bg-gray-900 rounded-none p-4 border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-none flex items-center justify-center mx-auto">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Anda Belum Memiliki Toko / Kantin</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm mx-auto">
              Daftarkan toko/kantin Anda sekarang di halaman Profil untuk mulai mengunggah produk dan menerima pesanan santri.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: '/dashboard/profile' })}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            Buat Toko di Profil
          </button>
        </div>
      )}

      {/* Ringkasan Pendapatan (Harian, Mingguan, Bulanan) */}
      <div className="bg-white dark:bg-gray-900 rounded-none p-2.5 sm:p-3 border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            Ringkasan Pendapatan
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-gray-50/80 dark:bg-gray-800/60 p-2 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase font-bold leading-none">Hari Ini</p>
              <p className="text-xs sm:text-sm font-black font-mono text-gray-900 dark:text-white mt-1 truncate">
                {formatRupiah(analytics?.today_income)}
              </p>
            </div>
            <div className="w-6 h-6 rounded-none bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/40">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          
          <div className="bg-gray-50/80 dark:bg-gray-800/60 p-2 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase font-bold leading-none">Minggu Ini</p>
              <p className="text-xs sm:text-sm font-black font-mono text-green-700 dark:text-green-400 mt-1 truncate">
                {formatRupiah(analytics?.this_week_income)}
              </p>
            </div>
            <div className="w-6 h-6 rounded-none bg-green-50 dark:bg-green-950/60 flex items-center justify-center shrink-0 border border-green-200 dark:border-green-800/40">
              <Calendar className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-gray-50/80 dark:bg-gray-800/60 p-2 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase font-bold leading-none">Bulan Ini</p>
              <p className="text-xs sm:text-sm font-black font-mono text-teal-700 dark:text-teal-400 mt-1 truncate">
                {formatRupiah(analytics?.this_month_income)}
              </p>
            </div>
            <div className="w-6 h-6 rounded-none bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800/40">
              <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Peringkat Performa Toko (GoBiz Style Outlet Performance) */}
      <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="p-2.5 sm:p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            Performa Toko Anda
          </h3>
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded-none border border-gray-200 dark:border-gray-700">
            {analytics?.store_performance?.length || 0} Outlet
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(!analytics?.store_performance || analytics.store_performance.length === 0) ? (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">Belum ada data toko atau transaksi.</div>
          ) : (
            analytics.store_performance.map((store, index) => (
              <div 
                key={store.id} 
                onClick={() => handleSelectStore(store.id)}
                className="p-2 sm:p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-6 h-6 rounded-none flex items-center justify-center font-bold shrink-0 text-[10px] font-mono border ${
                    index === 0 
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' 
                      : index === 1 
                        ? 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' 
                        : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700/50'
                  }`}>
                    #{index + 1}
                  </div>
                  <div className="w-9 h-9 rounded-none bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 flex items-center justify-center overflow-hidden shrink-0">
                    <AppImage 
                      src={store.image} 
                      alt={store.name} 
                      type="canteen" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white group-hover:text-green-600 transition-colors truncate">
                      {store.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                      {store.total_orders} pesanan selesai
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-1.5 ml-2">
                  <p className="font-bold text-xs sm:text-sm font-mono text-green-700 dark:text-green-400">
                    {formatRupiah(store.total_income)}
                  </p>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-green-600 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Riwayat Transaksi Global */}
      <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="p-2.5 sm:p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            Riwayat Transaksi Terbaru
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(!analytics?.recent_transactions || analytics.recent_transactions.length === 0) ? (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">Belum ada riwayat transaksi.</div>
          ) : (
            analytics.recent_transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="p-2 sm:p-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-none bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800/40 flex items-center justify-center shrink-0">
                    <Wallet className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white truncate">{tx.customer_name}</h4>
                    <p className="text-[10px] text-gray-400 truncate leading-none mt-0.5">{tx.canteen_name} &bull; {tx.date}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="font-bold text-xs font-mono text-green-700 dark:text-green-400">+{formatRupiah(tx.amount)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
