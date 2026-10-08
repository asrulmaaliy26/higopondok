import React from 'react';
import { Users, Wallet, TrendingUp, AlertCircle, ArrowRight, ClipboardList, Store, Shield, Ticket, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/axios';
import { Link } from '@tanstack/react-router';
import ThemeToggle from '../../ui/ThemeToggle';
import SyncDbButton from '../../common/SyncDbButton';
import LoadingSpinner from '../../common/LoadingSpinner';
import { getUserRole, ROLES } from '../../../config/roles';

export default function AdminDashboard({ user }) {
  const role = getUserRole(user);
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const { data: adminStats, isLoading } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data;
    }
  });

  const paymentSummary = adminStats?.payment_summary;
  const ordersLink = isSuperAdmin ? '/dashboard/admin/pesanan' : '/dashboard/toko-saya/pesanan';

  if (isLoading && !adminStats) {
    return (
      <div className="space-y-3 font-sans">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-none shadow-xs">
          <LoadingSpinner 
            text="Memuat Data Dashboard..." 
            subtext="Mengambil ringkasan aktivitas dan keuangan pondok" 
            minHeight="min-h-[160px]"
          />
        </div>
      </div>
    );
  }

  const stats = [
    { title: 'Total Santri Aktif', value: adminStats?.total_santri || 0, href: isSuperAdmin ? '/dashboard/users' : '#', icon: Users, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' },
    { title: 'Tagihan Belum Dibayar', value: `Rp ${(adminStats?.total_admin_debt || 0).toLocaleString('id-ID')}`, href: isSuperAdmin ? '/dashboard/pertokoan' : '/dashboard/toko-saya', icon: Wallet, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
    { title: 'Transaksi Kantin', value: adminStats?.total_transactions || 0, href: ordersLink, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
    { title: 'Menunggu Persetujuan', value: adminStats?.pending_approvals || 0, href: isSuperAdmin ? '/dashboard/pertokoan' : '/dashboard/toko-saya', icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  ];

  return (
    <div className="space-y-2">
      {/* COMPACT WELCOME BANNER */}
      <div className="relative rounded-none bg-gradient-to-r from-emerald-800 via-green-700 to-teal-800 dark:from-emerald-950 dark:via-green-950 dark:to-gray-900 p-2.5 sm:p-3 text-white overflow-hidden shadow-xs border border-green-600/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-1.5">
              <span>Selamat Datang, {user?.name || 'Administrator'}!</span>
              <span className="text-sm">👋</span>
              {isSuperAdmin ? (
                <span className="ml-1 text-[9px] font-black uppercase tracking-widest bg-amber-400 text-amber-900 px-1.5 py-0.5">Super Admin</span>
              ) : (
                <span className="ml-1 text-[9px] font-black uppercase tracking-widest bg-green-400/30 text-green-100 px-1.5 py-0.5">Admin</span>
              )}
            </h2>
            <p className="text-green-100/90 dark:text-emerald-200/80 text-[11px] leading-tight mt-0.5 max-w-2xl truncate">
              Ringkasan aktivitas pondok pesantren hari ini. Anda memiliki beberapa laporan baru yang perlu ditinjau.
            </p>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            <ThemeToggle variant="pill-light" />
          </div>
        </div>
      </div>

      {/* AKSES CEPAT ADMIN */}
      <div className="bg-white dark:bg-gray-900 rounded-none p-2 sm:p-2.5 border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Akses Cepat Menu Admin
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          <Link
            to={ordersLink}
            className="flex flex-col items-center text-center justify-center p-2 rounded-none bg-green-50/60 hover:bg-green-100/70 dark:bg-green-950/40 dark:hover:bg-green-900/50 transition-all border border-green-200/70 dark:border-green-800/60 shadow-2xs cursor-pointer"
          >
            <ClipboardList className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
            <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
              {isSuperAdmin ? 'Rekap & Pesanan' : 'Pesanan Toko'}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block leading-none mt-0.5">Semua Transaksi Toko</span>
          </Link>

          <Link
            to={isSuperAdmin ? "/dashboard/pertokoan" : "/dashboard/toko-saya"}
            className="flex flex-col items-center text-center justify-center p-2 rounded-none bg-green-50/60 hover:bg-green-100/70 dark:bg-green-950/40 dark:hover:bg-green-900/50 transition-all border border-green-200/70 dark:border-green-800/60 shadow-2xs cursor-pointer"
          >
            <Store className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
            <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
              {isSuperAdmin ? 'Manajemen Toko' : 'Katalog & Toko'}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block leading-none mt-0.5">
              {isSuperAdmin ? 'Kantin & Biaya Ongkir' : 'Kelola Toko & Menu'}
            </span>
          </Link>

          {isSuperAdmin && (
            <Link
              to="/dashboard/users"
              className="flex flex-col items-center text-center justify-center p-2 rounded-none bg-green-50/60 hover:bg-green-100/70 dark:bg-green-950/40 dark:hover:bg-green-900/50 transition-all border border-green-200/70 dark:border-green-800/60 shadow-2xs cursor-pointer"
            >
              <Users className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
              <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">Manajemen User</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block leading-none mt-0.5">Santri, Kantin & Kurir</span>
            </Link>
          )}

          <Link
            to="/dashboard/admin/vouchers"
            className="flex flex-col items-center text-center justify-center p-2 rounded-none bg-green-50/60 hover:bg-green-100/70 dark:bg-green-950/40 dark:hover:bg-green-900/50 transition-all border border-green-200/70 dark:border-green-800/60 shadow-2xs cursor-pointer"
          >
            <Ticket className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
            <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">Manajemen Voucher</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block leading-none mt-0.5">Kupon Potongan Biaya</span>
          </Link>

          <Link
            to="/dashboard/admin-logs"
            className="flex flex-col items-center text-center justify-center p-2 rounded-none bg-green-50/60 hover:bg-green-100/70 dark:bg-green-950/40 dark:hover:bg-green-900/50 transition-all border border-green-200/70 dark:border-green-800/60 shadow-2xs cursor-pointer"
          >
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
            <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">Log Aktivitas</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block leading-none mt-0.5">Riwayat Audit Sistem</span>
          </Link>

          <SyncDbButton variant="card" />
        </div>
      </div>

      {/* 4 STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {stats.map((stat, idx) => (
          <Link
            key={idx}
            to={stat.href}
            className="bg-white dark:bg-gray-900 rounded-none p-2 sm:p-2.5 border border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-green-600 transition-all shadow-xs flex items-center justify-between group cursor-pointer"
          >
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block truncate">
                {stat.title}
              </span>
              <p className="mt-0.5 text-lg sm:text-2xl font-black font-mono text-gray-900 dark:text-white leading-none truncate">
                {stat.value}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 border border-green-200 dark:border-green-800 ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </Link>
        ))}
      </div>

      {/* BOTTOM SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="bg-white dark:bg-gray-900 rounded-none p-2.5 sm:p-3 border border-gray-200 dark:border-gray-800 shadow-xs relative">
          <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">Aktivitas Terbaru</h3>
            <Link to="/dashboard/admin-logs" className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center font-bold">
              Lihat Semua Log <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
          <div className="space-y-1">
            {adminStats?.recent_activities?.length > 0 ? (
              adminStats.recent_activities.map((activity) => (
                <div key={activity.id} className="flex items-center p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-none transition-colors border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50">
                  <div className="w-7 h-7 rounded-none bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 flex items-center justify-center mr-2 shrink-0">
                    <Users className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{activity.title}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-none mt-0.5">{activity.description}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-2 font-mono">{activity.time}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-3 text-center">Belum ada aktivitas terbaru.</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-none p-2.5 sm:p-3 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-green-600 dark:text-green-400" />
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">Ringkasan Pembayaran</h3>
              </div>
              <Link
                to={ordersLink}
                className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center font-bold"
              >
                Rekap Lengkap <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            {/* Mini Finansial KPI Grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="p-2 bg-green-50/70 dark:bg-green-950/40 border border-green-200/80 dark:border-green-800/60 rounded-none">
                <span className="text-[10px] font-bold text-green-800 dark:text-green-300 uppercase tracking-wider block truncate">
                  Total Omzet Toko
                </span>
                <p className="text-sm sm:text-base font-black font-mono text-green-700 dark:text-green-400 mt-0.5 leading-none">
                  Rp {(paymentSummary?.total_omzet || 0).toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
                  Hari ini: <strong className="font-mono text-gray-700 dark:text-gray-300">Rp {(paymentSummary?.today_omzet || 0).toLocaleString('id-ID')}</strong> ({paymentSummary?.today_orders || 0} order)
                </span>
              </div>

              <div className="p-2 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-none">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block truncate">
                  Pendapatan Admin
                </span>
                <p className="text-sm sm:text-base font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 leading-none">
                  Rp {(paymentSummary?.total_admin_fee || 0).toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
                  Ongkir Kurir: <strong className="font-mono text-gray-700 dark:text-gray-300">Rp {(paymentSummary?.total_delivery_fee || 0).toLocaleString('id-ID')}</strong>
                </span>
              </div>
            </div>

            {/* Status Transaksi Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-none mb-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-gray-600 dark:text-gray-300 font-medium">Lunas:</span>
                <strong className="font-mono text-gray-900 dark:text-white font-bold">{paymentSummary?.paid_orders_count || 0}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-gray-600 dark:text-gray-300 font-medium">Pending:</span>
                <strong className="font-mono text-gray-900 dark:text-white font-bold">{paymentSummary?.unpaid_orders_count || 0}</strong>
              </div>
            </div>

            {/* Tabel Ringkasan Transaksi Pembayaran Terkini */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-1 px-1.5">Santri / Kantin</th>
                    <th className="py-1 px-1.5 text-center">Status</th>
                    <th className="py-1 px-1.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                  {paymentSummary?.recent_payments?.length > 0 ? (
                    paymentSummary.recent_payments.map((p) => {
                      const isPaid = p.payment_status === 'paid';
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="py-1.5 px-1.5">
                            <p className="font-bold text-gray-900 dark:text-white truncate max-w-[130px] sm:max-w-[190px]">
                              {p.user_name}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {p.canteen_name} • <span className="font-mono">{p.time}</span>
                            </p>
                          </td>
                          <td className="py-1.5 px-1.5 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-none border ${
                                isPaid
                                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-300 dark:border-green-800'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              }`}
                            >
                              {isPaid ? 'Lunas' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                            Rp {p.total_price.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                        Belum ada transaksi pembayaran
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
