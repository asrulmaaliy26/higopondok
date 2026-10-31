import React, { useState, useMemo } from 'react';
import { 
  Package, 
  CheckCircle, 
  Truck, 
  Wallet, 
  Power, 
  ArrowRight, 
  ShoppingBag, 
  Clock, 
  ChevronRight, 
  Search,
  Store,
  MapPin,
  Receipt
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import api from '../../../lib/axios';
import { useAuthStore } from '../../../store/authStore';
import ThemeToggle from '../../ui/ThemeToggle';

// Helper Biaya Pokok Produk (HPP / Modal Belanja di Kasir Toko)
export const getBiayaPokokProduk = (order) => {
  if (!order) return 0;
  
  // 1. Jika ada atribut hpp dari backend (hasil sum total_hpp items)
  if (order.hpp !== undefined && order.hpp !== null && parseFloat(order.hpp) > 0) {
    return parseFloat(order.hpp);
  }
  
  // 2. Hitung dari rincian items jika relasi items tersedia
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    const totalItemsHpp = order.items.reduce((sum, item) => {
      if (item.total_hpp !== undefined && item.total_hpp !== null && parseFloat(item.total_hpp) > 0) {
        return sum + parseFloat(item.total_hpp);
      }
      const rawHpp = item.hpp ?? item.product?.hpp;
      const qty = parseInt(item.quantity || 1, 10);
      if (rawHpp !== undefined && rawHpp !== null && parseFloat(rawHpp) > 0) {
        return sum + (parseFloat(rawHpp) * qty);
      }
      const price = parseFloat(item.price || 0);
      const estimatedHpp = price > 1000 ? (price - 1000) : price;
      return sum + (estimatedHpp * qty);
    }, 0);

    if (totalItemsHpp > 0) {
      return totalItemsHpp;
    }
  }

  // 3. Fallback jika items kosong: total_price dikurangi ongkir dan admin_fee
  const totalPrice = parseFloat(order.total_price || 0);
  const deliveryFee = parseFloat(order.delivery_fee || 0);
  const adminFee = parseFloat(order.admin_fee || 0);
  const subtotal = Math.max(0, totalPrice - deliveryFee - adminFee);
  return subtotal > 1000 ? (subtotal - 1000) : subtotal;
};

export default function KurirDashboard({ user }) {
  const navigate = useNavigate();
  const setUser = useAuthStore(state => state.setUser);
  const [searchTerm, setSearchTerm] = useState('');
  
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put('/me/working-status');
      return res.data;
    },
    onSuccess: (data) => {
      setUser({ ...user, is_working: data.is_working });
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Gagal mengubah status');
    }
  });

  const { data: rawOrders = [] } = useQuery({
    queryKey: ['courier_orders'],
    queryFn: async () => {
      const res = await api.get('/courier/orders');
      return res.data?.data || res.data || [];
    },
    refetchInterval: 6000
  });

  const orders = useMemo(() => {
    if (Array.isArray(rawOrders)) return rawOrders;
    if (rawOrders && Array.isArray(rawOrders.data)) return rawOrders.data;
    return [];
  }, [rawOrders]);

  // Pesanan yang masih diproses / belum diselesaikan (Semua tanpa batasan hari)
  const inProgressOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pending' || o.status === 'processing');
  }, [orders]);

  // Tugas aktif spesifik kurir ini
  const myTasks = useMemo(() => {
    return orders.filter(o => o.courier_id === user?.id && o.status === 'processing');
  }, [orders, user?.id]);
  
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const completedToday = useMemo(() => {
    return orders.filter(o => o.status === 'completed' && o.updated_at?.startsWith(todayStr));
  }, [orders, todayStr]);

  const totalEarnings = useMemo(() => {
    return orders.filter(o => o.status === 'completed' && o.courier_id === user?.id).reduce((sum, o) => {
       const fee = parseFloat(o.courier_net_delivery_fee ?? (o.delivery_fee > 0 ? o.delivery_fee : (o.voucher_id ? 3000 : 0)));
       return sum + fee;
    }, 0);
  }, [orders, user?.id]);

  // Total Biaya Pokok Seluruh Pesanan Belum Selesai (Semua Hari)
  const totalBiayaPokokAllActive = useMemo(() => {
    return inProgressOrders.reduce((sum, o) => sum + getBiayaPokokProduk(o), 0);
  }, [inProgressOrders]);

  // Filter pencarian pada pesanan aktif
  const displayedActiveOrders = useMemo(() => {
    if (!searchTerm.trim()) return inProgressOrders;
    const q = searchTerm.toLowerCase().trim();
    const cleanQ = q.replace(/^#/, '');

    return inProgressOrders.filter(o => {
      const matchId = cleanQ && o.id?.toString().includes(cleanQ);
      const matchSantri = (o.recipient_santri_name || o.user?.santri_name || o.user?.name)?.toLowerCase().includes(q);
      const matchCanteen = o.canteen?.name?.toLowerCase().includes(q);
      const matchRoom = (o.recipient_santri_room || o.user?.santri_room || o.delivery_location)?.toLowerCase().includes(q);
      const matchItem = o.items?.some(i => i.product?.name?.toLowerCase().includes(q));
      return matchId || matchSantri || matchCanteen || matchRoom || matchItem;
    });
  }, [inProgressOrders, searchTerm]);

  const stats = [
    { 
      title: 'Belum Selesai (Semua)', 
      value: inProgressOrders.length.toString(), 
      sub: 'Perlu diproses / diantar',
      icon: Package, 
      color: 'text-amber-600', 
      bg: 'bg-amber-100 dark:bg-amber-900/50' 
    },
    { 
      title: 'Total Biaya Pokok', 
      value: `Rp ${Math.round(totalBiayaPokokAllActive).toLocaleString('id-ID')}`, 
      sub: 'Modal belanja kasir toko',
      icon: Receipt, 
      color: 'text-emerald-700 dark:text-emerald-400', 
      bg: 'bg-emerald-100 dark:bg-emerald-900/50' 
    },
    { 
      title: 'Tugas Saya (Diantar)', 
      value: myTasks.length.toString(), 
      sub: 'Sedang dalam pengantaran',
      icon: Truck, 
      color: 'text-green-600', 
      bg: 'bg-green-100 dark:bg-green-900/50' 
    },
    { 
      title: 'Selesai Hari Ini', 
      value: completedToday.length.toString(), 
      sub: `Ongkir: Rp ${Math.round(totalEarnings).toLocaleString('id-ID')}`,
      icon: CheckCircle, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-100 dark:bg-emerald-900/50' 
    },
  ];

  return (
    <div className="space-y-4">
      {/* STATUS WORKING TOGGLE & THEME TOGGLE */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
        <div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-0.5">Status Kerja Kurir</p>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-none ${user?.is_working ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">{user?.is_working ? 'Online Siap Antar 🛵' : 'Sedang Istirahat ⏸️'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle size="md" />
          <button 
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className={`p-2 sm:px-3 rounded-none transition-colors shadow-2xs flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
              user?.is_working 
              ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800/40' 
              : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/60 dark:text-green-400 border border-green-200 dark:border-green-800/40'
            }`}
            title="Klik untuk ubah status online/offline"
          >
            <Power className="w-4 h-4" />
            <span className="hidden sm:inline">{user?.is_working ? 'Matikan' : 'Aktifkan'}</span>
          </button>
        </div>
      </div>

      {/* BANNER REKAP BIAYA POKOK & PENGANTARAN */}
      <div className="relative rounded-none bg-gradient-to-r from-emerald-800 via-green-800 to-teal-900 dark:from-emerald-950 dark:via-green-950 dark:to-gray-900 p-3.5 sm:p-4 text-white overflow-hidden shadow-xs border border-green-600/40">
        <div className="relative z-10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-200/90 block">Rekapitulasi Modal Belanja Toko</span>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                Semangat bertugas, {user?.name}! 🛵
              </h2>
            </div>
            <div className="bg-black/30 border border-white/10 px-3 py-1.5 rounded-none flex items-center justify-between sm:justify-end gap-3">
              <span className="text-[11px] text-green-200 font-medium">Total Pokok Belanja:</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-300">
                Rp {Math.round(totalBiayaPokokAllActive).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <p className="text-green-100 dark:text-emerald-200/80 text-[11px] max-w-xl">
              Terdapat <strong className="text-white underline">{inProgressOrders.length} pesanan aktif</strong> yang belum selesai diantar ke santri.
            </p>
            <button
              onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
              className="py-1.5 px-3 bg-white hover:bg-green-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-green-800 dark:text-emerald-300 font-bold rounded-none text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 border border-transparent dark:border-emerald-700/40 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-green-700 dark:text-emerald-400" />
              <span>Buka Menu Tugas Kurir</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none p-2.5 sm:p-3 shadow-xs">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">{stat.title}</p>
                <p className="mt-0.5 text-base sm:text-lg font-black font-mono text-gray-900 dark:text-white truncate">{stat.value}</p>
                {stat.sub && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{stat.sub}</p>
                )}
              </div>
              <div className={`p-2 rounded-none ${stat.bg} shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SEMUA PESANAN BELUM DISELESAIKAN (BUKAN PER HARI TAPI SEMUANYA) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none p-3 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-2.5">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Semua Pesanan Belum Selesai ({inProgressOrders.length})
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              Daftar seluruh pesanan aktif yang masih diproses/diantar dari semua tanggal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Total Pokok:</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-mono font-black text-xs border border-emerald-300 dark:border-emerald-800">
              Rp {Math.round(totalBiayaPokokAllActive).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* SEARCH FILTER RINGKAS */}
        {inProgressOrders.length > 3 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari santri, kamar, toko, atau no order..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        )}

        {displayedActiveOrders.length === 0 ? (
          <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
            {searchTerm ? 'Tidak ada pesanan yang cocok dengan pencarian.' : 'Alhamdulillah! Tidak ada pesanan tertunda yang belum selesai.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-[60vh] overflow-y-auto pr-1">
            {displayedActiveOrders.map(order => {
              const biayaPokok = getBiayaPokokProduk(order);
              const santriName = order.recipient_santri_name || order.user?.santri_name || order.user?.name || 'Santri';
              const location = order.recipient_santri_room || order.user?.santri_room || order.delivery_location || 'Asrama';
              const canteenName = order.canteen?.name || 'Toko';
              const isMine = order.courier_id === user?.id;
              
              // Ringkasan item
              const itemsSummary = order.items && order.items.length > 0
                ? order.items.map(i => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')
                : (order.custom_notes || 'Pesanan');

              return (
                <div 
                  key={order.id}
                  onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
                  className="py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 p-2 rounded-none transition-colors border-l-2 border-transparent hover:border-emerald-500"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        {santriName}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">#{order.id}</span>
                      {order.created_at && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                          ({new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })})
                        </span>
                      )}
                      {isMine && (
                        <span className="px-1 py-0.2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[9px] font-bold border border-emerald-300 dark:border-emerald-800">
                          Tugas Saya
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1 truncate text-gray-700 dark:text-gray-300 font-medium">
                        <Store className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> {canteenName}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" /> {location}
                      </span>
                    </div>

                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={itemsSummary}>
                      🛍️ {itemsSummary}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-gray-100 dark:border-gray-800">
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-semibold">
                        Biaya Pokok Produk
                      </span>
                      <span className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        Rp {Math.round(biayaPokok).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-none ${
                        order.status === 'pending' 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50' 
                          : 'bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-green-300 border border-green-200 dark:border-green-800/50'
                      }`}>
                        {order.status === 'pending' ? 'Menunggu' : 'Sedang Diantar'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
