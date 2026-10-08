import React from 'react';
import { Package, CheckCircle, Truck, Wallet, Power, ArrowRight, ShoppingBag, Clock, ChevronRight } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import api from '../../../lib/axios';
import { useAuthStore } from '../../../store/authStore';
import ThemeToggle from '../../ui/ThemeToggle';

export default function KurirDashboard({ user }) {
  const navigate = useNavigate();
  const setUser = useAuthStore(state => state.setUser);
  
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

  const orders = React.useMemo(() => {
    if (Array.isArray(rawOrders)) return rawOrders;
    if (rawOrders && Array.isArray(rawOrders.data)) return rawOrders.data;
    return [];
  }, [rawOrders]);

  const availableOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
  const myTasks = orders.filter(o => o.courier_id === user?.id && o.status === 'processing');
  
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const completedToday = orders.filter(o => o.status === 'completed' && o.updated_at?.startsWith(todayStr));
  const completedCount = completedToday.length;

  const totalEarnings = orders.filter(o => o.status === 'completed' && o.courier_id === user?.id).reduce((sum, o) => {
     const fee = parseFloat(o.courier_net_delivery_fee ?? (o.delivery_fee > 0 ? o.delivery_fee : (o.voucher_id ? 3000 : 0)));
     return sum + fee;
  }, 0);

  const stats = [
    { title: 'Perlu Diantar', value: availableOrders.length.toString(), icon: Package, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/50' },
    { title: 'Tugas Aktif Saya', value: myTasks.length.toString(), icon: Truck, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/50' },
    { title: 'Selesai Hari Ini', value: completedCount.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/50' },
    { title: 'Pendapatan Ongkir', value: `Rp ${Math.round(totalEarnings).toLocaleString('id-ID')}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/50' },
  ];

  return (
    <div className="space-y-5">
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

      {/* BANNER GREETING WITH QUICK CTA */}
      <div className="relative rounded-none bg-gradient-to-r from-emerald-800 via-green-700 to-teal-800 dark:from-emerald-950 dark:via-green-950 dark:to-gray-900 p-3 sm:p-4 text-white overflow-hidden shadow-xs border border-green-600/30">
        <div className="relative z-10 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">Semangat bertugas, {user?.name}! 🛵</h2>
              <p className="text-green-100 dark:text-emerald-200/80 text-[11px] max-w-xl mt-0.5">
                Ada <strong className="text-white underline">{availableOrders.length} pesanan makanan</strong> dari wali/santri yang siap untuk diantarkan ke asrama.
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <ThemeToggle variant="pill-light" />
            </div>
          </div>

          <button
            onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
            className="py-2 px-3 bg-white hover:bg-green-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-green-800 dark:text-emerald-300 font-bold rounded-none text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 border border-transparent dark:border-emerald-700/40 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-green-700 dark:text-emerald-400" />
            <span>Lihat Semua Pesanan & List Makanan</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none p-2 sm:p-2.5 shadow-xs">
            <div className="flex items-center justify-between gap-1.5">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">{stat.title}</p>
                <p className="mt-0.5 text-base sm:text-lg font-black font-mono text-gray-900 dark:text-white truncate">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-none ${stat.bg} shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT ACTIVE TASKS PREVIEW */}
      {availableOrders.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none p-3 sm:p-3.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              Pesanan Aktif Terbaru
            </h3>
            <button
              onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
              className="text-xs font-bold text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Semua ({availableOrders.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {availableOrders.slice(0, 3).map(order => (
              <div 
                key={order.id}
                onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
                className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/60 p-1.5 rounded-none transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white text-xs truncate">
                      {order.user?.santri_name || order.user?.name}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">#{order.id}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    📍 {order.user?.santri_room || order.delivery_location || 'Asrama'} • {order.canteen?.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black font-mono text-green-600 dark:text-green-400 block">
                    Rp {Math.round(Math.max(0, parseFloat(order.total_price || 0) - parseFloat(order.admin_fee || 0))).toLocaleString('id-ID')}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-none ${
                    order.status === 'pending' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50' 
                      : 'bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-green-300 border border-green-200 dark:border-green-800/50'
                  }`}>
                    {order.status === 'pending' ? 'Menunggu' : 'Diantar'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
