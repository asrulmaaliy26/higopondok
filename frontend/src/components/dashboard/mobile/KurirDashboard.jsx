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
      <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Status Kerja Kurir</p>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${user?.is_working ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <span className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">{user?.is_working ? 'Online Siap Antar 🛵' : 'Sedang Istirahat ⏸️'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle size="md" />
          <button 
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className={`p-3 rounded-xl transition-colors shadow-xs flex items-center gap-2 text-xs font-bold ${
              user?.is_working 
              ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-400 dark:border dark:border-red-800/40' 
              : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/60 dark:text-green-400 dark:border dark:border-green-800/40'
            }`}
            title="Klik untuk ubah status online/offline"
          >
            <Power className="w-5 h-5" />
            <span className="hidden sm:inline">{user?.is_working ? 'Matikan' : 'Aktifkan'}</span>
          </button>
        </div>
      </div>

      {/* BANNER GREETING WITH QUICK CTA */}
      <div className="relative rounded-2xl bg-gradient-to-r from-emerald-700 via-green-700 to-teal-700 dark:from-emerald-950 dark:via-green-950 dark:to-gray-900 p-5 sm:p-6 text-white overflow-hidden shadow-lg shadow-green-900/20 dark:shadow-black/50 border border-transparent dark:border-emerald-800/40">
        <div className="relative z-10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold mb-1 text-white">Semangat bertugas, {user?.name}! 🛵</h2>
              <p className="text-green-100 dark:text-emerald-200/80 text-xs sm:text-sm max-w-xl">
                Ada <strong className="text-white underline">{availableOrders.length} pesanan makanan</strong> dari wali/santri yang siap untuk diantarkan ke asrama.
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <ThemeToggle variant="pill-light" />
            </div>
          </div>

          <button
            onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
            className="py-2.5 px-4 bg-white hover:bg-green-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-green-800 dark:text-emerald-300 font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 border border-transparent dark:border-emerald-700/40"
          >
            <ShoppingBag className="w-4 h-4 text-green-700 dark:text-emerald-400" />
            Lihat Semua Pesanan & List Makanan
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card rounded-2xl p-3.5 sm:p-5 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{stat.title}</p>
                <p className="mt-1 text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white truncate">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT ACTIVE TASKS PREVIEW */}
      {availableOrders.length > 0 && (
        <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
              Pesanan Aktif Terbaru
            </h3>
            <button
              onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
              className="text-xs font-bold text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center gap-1"
            >
              Semua ({availableOrders.length}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {availableOrders.slice(0, 3).map(order => (
              <div 
                key={order.id}
                onClick={() => navigate({ to: '/dashboard/tugas-kurir' })}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/60 p-1.5 rounded-xl transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white text-xs truncate">
                      {order.user?.santri_name || order.user?.name}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">#{order.id}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    📍 {order.user?.santri_room || order.delivery_location || 'Asrama'} • {order.canteen?.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-green-600 dark:text-green-400 block">
                    Rp {Math.round(Math.max(0, parseFloat(order.total_price || 0) - parseFloat(order.admin_fee || 0))).toLocaleString('id-ID')}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    order.status === 'pending' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 dark:border dark:border-amber-800/50' 
                      : 'bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-green-300 dark:border dark:border-green-800/50'
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
