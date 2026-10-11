import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { 
  Activity, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  User, 
  Package, 
  Clock, 
  Search, 
  Store, 
  ShoppingCart, 
  ShieldCheck, 
  Tag, 
  DollarSign, 
  Image as ImageIcon, 
  Box, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  RotateCcw,
  Trophy,
  Award,
  TrendingUp,
  Sparkles,
  Medal,
  GraduationCap,
  Users,
  Phone,
  Mail,
  Wallet,
  X,
  FileText,
  Eye
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { 
  parseActivityTags, 
  getActionBadge, 
  getModelBadge as getModelBadgeBase, 
  getRoleBadge 
} from '../../lib/activityLogUtils';

export default function AdminLogs() {
  const [activeTab, setActiveTab] = useState('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [page, setPage] = useState(1);
  const [isLive, setIsLive] = useState(true);
  const [achievementCategory, setAchievementCategory] = useState('users');

  // State untuk Tab Seluruh Santri
  const [santriSearch, setSantriSearch] = useState('');
  const [santriLevel, setSantriLevel] = useState('all');
  const [santriClass, setSantriClass] = useState('all');
  const [santriRoom, setSantriRoom] = useState('all');
  const [santriSort, setSantriSort] = useState('name_asc');
  const [santriPage, setSantriPage] = useState(1);
  const [selectedSantriId, setSelectedSantriId] = useState(null);
  const [isSantriModalOpen, setIsSantriModalOpen] = useState(false);

  // Query Aktivitas Sistem dengan Polling Realtime Otomatis
  const { 
    data: activityData, 
    isLoading: loadingActivity, 
    isFetching: fetchingActivity 
  } = useQuery({
    queryKey: ['admin_activity_logs', searchTerm, selectedAction, dateFilter, customDate, page],
    queryFn: async () => {
      const res = await axios.get('/admin/logs/activity', {
        params: {
          page,
          search: searchTerm || undefined,
          action: selectedAction !== 'all' ? selectedAction : undefined,
          date_filter: dateFilter !== 'all' && dateFilter !== 'custom' ? dateFilter : undefined,
          date: dateFilter === 'custom' ? customDate : undefined,
        }
      });
      return res.data;
    },
    enabled: activeTab === 'activity',
    refetchInterval: isLive && activeTab === 'activity' ? 12000 : false,
    refetchIntervalInBackground: false,
  });

  const { data: paymentLogs, isLoading: loadingPayment } = useQuery({
    queryKey: ['admin_payment_logs'],
    queryFn: async () => {
      const res = await axios.get('/admin/logs/payment');
      return res.data.data;
    },
    enabled: activeTab === 'payment',
  });

  const { data: achievementsData, isLoading: loadingAchievements } = useQuery({
    queryKey: ['admin_achievements'],
    queryFn: async () => {
      const res = await axios.get('/admin/logs/achievements');
      return res.data;
    },
    enabled: activeTab === 'achievements',
  });

  const { data: santriResponse, isLoading: loadingSantri } = useQuery({
    queryKey: ['admin_santri_list', santriSearch, santriLevel, santriClass, santriRoom, santriSort, santriPage],
    queryFn: async () => {
      const res = await axios.get('/admin/logs/santri', {
        params: {
          page: santriPage,
          search: santriSearch || undefined,
          level: santriLevel !== 'all' ? santriLevel : undefined,
          class: santriClass !== 'all' ? santriClass : undefined,
          room: santriRoom !== 'all' ? santriRoom : undefined,
          sort_by: santriSort,
        }
      });
      return res.data;
    },
    enabled: activeTab === 'santri',
  });

  const { data: santriDetailData, isLoading: loadingSantriDetail } = useQuery({
    queryKey: ['admin_santri_detail', selectedSantriId],
    queryFn: async () => {
      const res = await axios.get(`/admin/logs/santri/${selectedSantriId}`);
      return res.data;
    },
    enabled: !!selectedSantriId && isSantriModalOpen,
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const getModelBadge = (modelType) => {
    const base = getModelBadgeBase(modelType);
    let icon = <Activity className="w-2.5 h-2.5" />;
    if (base.type === 'product') icon = <Package className="w-2.5 h-2.5" />;
    else if (base.type === 'canteen') icon = <Store className="w-2.5 h-2.5" />;
    else if (base.type === 'order') icon = <ShoppingCart className="w-2.5 h-2.5" />;
    else if (base.type === 'user') icon = <User className="w-2.5 h-2.5" />;
    return { ...base, icon };
  };

  const getTagIcon = (key) => {
    switch (key) {
      case 'price': return <DollarSign className="w-2.5 h-2.5" />;
      case 'category': return <Tag className="w-2.5 h-2.5" />;
      case 'image': return <ImageIcon className="w-2.5 h-2.5" />;
      case 'stock': return <Box className="w-2.5 h-2.5" />;
      case 'status': return <CheckCircle2 className="w-2.5 h-2.5" />;
      case 'variant': return <Package className="w-2.5 h-2.5" />;
      case 'cancel': return <AlertCircle className="w-2.5 h-2.5" />;
      case 'courier': return <User className="w-2.5 h-2.5" />;
      default: return <Activity className="w-2.5 h-2.5" />;
    }
  };

  const renderDetailTags = (description = '') => {
    const tags = parseActivityTags(description);
    if (!tags || tags.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800/80">
        {tags.map((t, idx) => (
          <span key={idx} className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9.5px] font-bold border rounded-none ${t.color}`}>
            {getTagIcon(t.key)}
            <span>{t.label}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="pb-24 bg-gray-50 dark:bg-gray-950 min-h-screen">
      {/* Header Ramping & Tegas (Flat Sharp rounded-none) */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-3 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link 
              to="/dashboard" 
              className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none text-gray-700 dark:text-gray-200 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Log Audit Sistem</span>
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                Rekaman perubahan data menu, toko, status pesanan, & arus kas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLive(!isLive)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-bold border rounded-none cursor-pointer transition-colors ${
                isLive
                  ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-300 dark:border-green-800'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700'
              }`}
              title={isLive ? 'Live Monitor Aktif (Pembaruan Otomatis 12 detik)' : 'Klik untuk Mengaktifkan Live Monitor'}
            >
              <span className={`w-1.5 h-1.5 ${isLive ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-mono text-[10px]">{isLive ? 'Live Monitor' : 'Jeda Monitor'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigasi Flat */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mt-3 -mb-3 gap-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer rounded-none whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Aktivitas Sistem</span>
            {(activityData?.total ?? 0) > 0 && (
              <span className="ml-1 text-[9px] px-1 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono font-bold rounded-none">
                {activityData?.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer rounded-none whitespace-nowrap ${
              activeTab === 'payment'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Transaksi & Keuangan</span>
            {paymentLogs?.length > 0 && (
              <span className="ml-1 text-[9px] px-1 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono font-bold rounded-none">
                {paymentLogs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer rounded-none whitespace-nowrap ${
              activeTab === 'achievements'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Prestasi & Audit Positif</span>
          </button>
          <button
            onClick={() => setActiveTab('santri')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer rounded-none whitespace-nowrap ${
              activeTab === 'santri'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
            <span>Seluruh Santri</span>
            {santriResponse?.meta_counts?.total_santri && (
              <span className="ml-1 text-[9px] px-1 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono font-bold rounded-none">
                {santriResponse.meta_counts.total_santri}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-3">
        {/* Filter & Pencarian Cepat (High Density) */}
        {activeTab === 'activity' && (
          <div className="space-y-2">
            {/* Baris 1: Search & Aksi */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-none flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center shadow-2xs">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari aktivitas: harga, kategori, foto, nama menu, pengguna..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-green-600 rounded-none transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Action Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0 shrink-0">
                <span className="text-[10px] text-gray-400 font-bold uppercase mr-1 hidden sm:inline">Aksi:</span>
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'created', label: 'Tambah' },
                  { id: 'updated', label: 'Edit' },
                  { id: 'cancelled', label: 'Batal' },
                  { id: 'deleted', label: 'Hapus' },
                  { id: 'impersonate', label: 'Impersonasi' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSelectedAction(f.id);
                      setPage(1);
                    }}
                    className={`px-2 py-1 text-[10.5px] font-bold rounded-none border transition-colors cursor-pointer whitespace-nowrap ${
                      selectedAction === f.id
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Baris 2: Filter Rentang Tanggal (Date Range Bar) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 rounded-none flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0 shrink-0">
                <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1 mr-1">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className="hidden sm:inline">Waktu:</span>
                </span>
                {[
                  { id: 'all', label: 'Semua Waktu' },
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'yesterday', label: 'Kemarin' },
                  { id: '7_days', label: '7 Hari' },
                  { id: '30_days', label: '30 Hari' },
                  { id: 'custom', label: 'Pilih Tanggal' },
                ].map((df) => (
                  <button
                    key={df.id}
                    type="button"
                    onClick={() => {
                      setDateFilter(df.id);
                      setPage(1);
                    }}
                    className={`px-2 py-0.8 text-[10px] font-bold rounded-none border transition-colors cursor-pointer whitespace-nowrap ${
                      dateFilter === df.id
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-gray-400">Tgl:</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => {
                      setCustomDate(e.target.value);
                      setPage(1);
                    }}
                    className="px-1.5 py-0.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-mono rounded-none"
                  />
                  {customDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDate('');
                        setPage(1);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
                      title="Reset tanggal"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: AKTIVITAS SISTEM (Daftar Rapat & Detail) */}
        {activeTab === 'activity' && (
          <div className="space-y-2">
            {loadingActivity ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse p-3" />
                ))}
              </div>
            ) : (activityData?.data?.length ?? 0) > 0 ? (
              <>
                <div className="space-y-2">
                  {activityData.data.map((log) => {
                    const actBadge = getActionBadge(log.action);
                    const mdlBadge = getModelBadge(log.model_type);
                    const roleBadge = getRoleBadge(log.user?.roles);

                    return (
                      <div 
                        key={log.id} 
                        className="p-2.5 sm:p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs hover:border-green-600/70 transition-all flex flex-col gap-1.5"
                      >
                        {/* Baris 1: Header Log Rapat */}
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {/* Badge Action */}
                            <span className={`px-1.5 py-0.2 text-[9.5px] font-black border uppercase tracking-wider rounded-none ${actBadge.classes}`}>
                              {actBadge.label}
                            </span>

                            {/* Badge Model / Entitas */}
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 text-[9.5px] font-bold border rounded-none ${mdlBadge.classes}`}>
                              {mdlBadge.icon}
                              <span>{mdlBadge.label}</span>
                            </span>

                            {/* Pelaku */}
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[11px] text-gray-400">oleh</span>
                              <span className="font-bold text-gray-900 dark:text-gray-100 text-xs truncate">
                                {log.user?.name || 'Sistem / Anonim'}
                              </span>
                              {roleBadge && (
                                <span className={`px-1 py-0.1 text-[9px] font-bold rounded-none uppercase ${roleBadge.classes}`}>
                                  {roleBadge.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Waktu Presisi (Monospace) */}
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-mono text-[10.5px] shrink-0">
                            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                        </div>

                        {/* Baris 2: Deskripsi Detail Perubahan */}
                        <div className="bg-gray-50 dark:bg-gray-800/40 p-2 border border-gray-100 dark:border-gray-800/80 rounded-none">
                          <p className="text-xs text-gray-800 dark:text-gray-200 font-medium leading-relaxed break-words">
                            {log.description}
                          </p>
                          {/* Detail Tags (Harga, Kategori, Foto, Stok) */}
                          {renderDetailTags(log.description)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Kontrol Paginasi Mobile Flat Sharp */}
                {(activityData?.last_page ?? 1) > 1 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-none flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xs mt-3">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium text-center sm:text-left">
                      Menampilkan <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">{activityData.from} - {activityData.to}</span> dari <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">{activityData.total}</span> aktivitas
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={(activityData.current_page ?? 1) <= 1 || loadingActivity || fetchingActivity}
                        className="px-2.5 py-1 text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sebelumnya</span>
                      </button>

                      <div className="px-2 py-0.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                        Hal {activityData.current_page} / {activityData.last_page}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(activityData.last_page, p + 1))}
                        disabled={(activityData.current_page ?? 1) >= (activityData.last_page ?? 1) || loadingActivity || fetchingActivity}
                        className="px-2.5 py-1 text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <span>Selanjutnya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center rounded-none">
                <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Tidak ada catatan aktivitas ditemukan.</p>
                {(searchTerm || selectedAction !== 'all' || dateFilter !== 'all') && (
                  <button 
                    onClick={() => { 
                      setSearchTerm(''); 
                      setSelectedAction('all'); 
                      setDateFilter('all');
                      setCustomDate('');
                      setPage(1);
                    }} 
                    className="mt-2 text-xs text-green-600 font-bold hover:underline cursor-pointer"
                  >
                    Reset Semua Filter
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: KEUANGAN & TRANSAKSI (Tabel/Card Rapat) */}
        {activeTab === 'payment' && (
          <div className="space-y-2">
            {loadingPayment ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse p-3" />
                ))}
              </div>
            ) : paymentLogs?.length > 0 ? (
              <div className="space-y-2">
                {paymentLogs.map((log) => {
                  const isWithdraw = log.type === 'withdraw';
                  const isCourier = log.type === 'courier_fee';

                  return (
                    <div 
                      key={log.id} 
                      className="p-2.5 sm:p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs hover:border-green-600/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-none border shrink-0 ${
                          isWithdraw 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' 
                            : isCourier 
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
                        }`}>
                          <CreditCard className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.2 text-[9px] font-black border uppercase rounded-none ${
                              isWithdraw ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-green-100 text-green-800 border-green-300'
                            }`}>
                              {isWithdraw ? 'PENARIKAN' : isCourier ? 'ONGKIR KURIR' : 'TRANSAKSI'}
                            </span>
                            <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                              {log.description}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-gray-500 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" /> 
                              <strong className="text-gray-700 dark:text-gray-300">{log.user?.name || '-'}</strong>
                            </span>
                            {log.order && (
                              <span className="flex items-center gap-1 font-mono">
                                <Package className="w-3 h-3 text-gray-400" /> Pesanan #{log.order.id}
                              </span>
                            )}
                            <span className="flex items-center gap-1 font-mono text-gray-400">
                              <Clock className="w-3 h-3" /> {formatDate(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Kolom Angka Finansial (Monospace Rata Kanan) */}
                      <div className="text-right self-end sm:self-center shrink-0">
                        <span className="text-[10px] text-gray-400 block leading-tight">Nominal</span>
                        <span className={`font-mono font-bold text-sm sm:text-base ${
                          isWithdraw ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {isWithdraw ? '-' : '+'}Rp {parseFloat(log.amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center rounded-none">
                <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum ada catatan transaksi keuangan.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: PRESTASI & AUDIT POSITIF */}
        {activeTab === 'achievements' && (
          <div className="space-y-3">
            {loadingAchievements ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
                  ))}
                </div>
                <div className="h-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
              </div>
            ) : (
              <>
                {/* 1. Ringkasan Metrik Audit Positif (High-Density Flat Grid) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase block leading-tight">Pesanan Selesai</span>
                    <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white font-mono block mt-1">
                      {achievementsData?.summary?.total_completed_orders?.toLocaleString('id-ID') || 0}
                    </span>
                    <span className="text-[9.5px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> 100% Terverifikasi
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase block leading-tight">Rasio Keberhasilan</span>
                    <span className="text-base sm:text-lg font-black text-green-600 dark:text-green-400 font-mono block mt-1">
                      {achievementsData?.summary?.success_rate || 0}%
                    </span>
                    <span className="text-[9.5px] text-gray-400 block mt-0.5">
                      Tingkat Penyelesaian Tinggi
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase block leading-tight">Perputaran Belanja</span>
                    <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white font-mono block mt-1">
                      Rp {parseFloat(achievementsData?.summary?.total_turnover || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9.5px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1 mt-0.5">
                      <TrendingUp className="w-2.5 h-2.5" /> Arus Kas Berjalan
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase block leading-tight">Audit Integritas</span>
                    <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono block mt-1">
                      OPTIMAL
                    </span>
                    <span className="text-[9.5px] text-gray-400 block mt-0.5">
                      Disiplin Transaksi Tinggi
                    </span>
                  </div>
                </div>

                {/* 2. Pemilih Kategori Prestasi (High Density Flat Chips) */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 rounded-none flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {[
                      { id: 'users', label: 'Santri & Pelanggan Teraktif', icon: <User className="w-3 h-3" /> },
                      { id: 'canteens', label: 'Mitra Toko Terlaris', icon: <Store className="w-3 h-3" /> },
                      { id: 'couriers', label: 'Kurir Berprestasi', icon: <Package className="w-3 h-3" /> },
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAchievementCategory(c.id)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-none border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                          achievementCategory === c.id
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {c.icon}
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 font-bold hidden sm:inline">
                    Top Leaderboard
                  </span>
                </div>

                {/* 3. Tabel Rekapitulasi Presisi (Sesuai Aturan 13 AGENTS.md) */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs overflow-x-auto">
                  {achievementCategory === 'users' && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-2 px-2.5 w-12 text-center">Peringkat</th>
                          <th className="py-2 px-2.5">Nama Santri / Pelanggan</th>
                          <th className="py-2 px-2.5 hidden sm:table-cell">Kamar / Kelas</th>
                          <th className="py-2 px-2.5 text-center">Integritas</th>
                          <th className="py-2 px-2.5 text-right">Pesanan Selesai</th>
                          <th className="py-2 px-2.5 text-right">Total Belanja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                        {achievementsData?.top_users?.map((u) => (
                          <tr key={u.user_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 px-2.5 text-center">
                              <span className={`inline-block font-mono font-black text-xs px-1.5 py-0.2 rounded-none border ${
                                u.rank === 1 
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200' 
                                  : u.rank === 2
                                  ? 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                                  : u.rank === 3
                                  ? 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                #{u.rank}
                              </span>
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                <span>{u.name}</span>
                                {u.rank === 1 && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-gray-400 sm:hidden">
                                {u.room !== '-' ? `Kamar: ${u.room}` : ''} {u.class !== '-' ? `• Kelas: ${u.class}` : ''}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-gray-600 dark:text-gray-400 text-[11px] hidden sm:table-cell">
                              {u.room !== '-' ? `${u.room}` : '-'} / {u.class !== '-' ? u.class : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              {u.penalty_points === 0 ? (
                                <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 rounded-none">
                                  Disiplin (0)
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-none">
                                  {u.penalty_points} Poin
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                              {u.total_orders.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">
                              Rp {u.total_spent.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {achievementCategory === 'canteens' && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-2 px-2.5 w-12 text-center">Peringkat</th>
                          <th className="py-2 px-2.5">Nama Toko / Kantin</th>
                          <th className="py-2 px-2.5">Kategori</th>
                          <th className="py-2 px-2.5 text-right">Pesanan Selesai</th>
                          <th className="py-2 px-2.5 text-right">Total Omzet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                        {achievementsData?.top_canteens?.map((c) => (
                          <tr key={c.canteen_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 px-2.5 text-center">
                              <span className={`inline-block font-mono font-black text-xs px-1.5 py-0.2 rounded-none border ${
                                c.rank === 1 
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200' 
                                  : c.rank === 2
                                  ? 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                                  : c.rank === 3
                                  ? 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                #{c.rank}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-bold text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-1">
                                <span>{c.name}</span>
                                {c.rank === 1 && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-gray-500 dark:text-gray-400 text-[11px] uppercase font-bold">
                              {c.category}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                              {c.total_orders.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">
                              Rp {c.total_revenue.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {achievementCategory === 'couriers' && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-2 px-2.5 w-12 text-center">Peringkat</th>
                          <th className="py-2 px-2.5">Nama Kurir Pengantar</th>
                          <th className="py-2 px-2.5 text-right">Pesanan Terkirim</th>
                          <th className="py-2 px-2.5 text-right">Total Ongkir Diperoleh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                        {achievementsData?.top_couriers?.map((cr) => (
                          <tr key={cr.courier_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 px-2.5 text-center">
                              <span className={`inline-block font-mono font-black text-xs px-1.5 py-0.2 rounded-none border ${
                                cr.rank === 1 
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200' 
                                  : cr.rank === 2
                                  ? 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                #{cr.rank}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-bold text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-1">
                                <span>{cr.name}</span>
                                {cr.rank === 1 && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                              {cr.total_delivered.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">
                              Rp {cr.total_fee.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: SELURUH SANTRI & DATABASE LENGKAP */}
        {activeTab === 'santri' && (
          <div className="space-y-2.5">
            {/* Filter Bar Khusus Santri */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-none space-y-2 shadow-2xs">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                {/* Search Input Santri */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari santri: nama, wali, kamar, kelas, No HP..."
                    value={santriSearch}
                    onChange={(e) => {
                      setSantriSearch(e.target.value);
                      setSantriPage(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-green-600 rounded-none transition-colors"
                  />
                  {santriSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSantriSearch('');
                        setSantriPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Urutkan */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">Urutkan:</span>
                  <select
                    value={santriSort}
                    onChange={(e) => {
                      setSantriSort(e.target.value);
                      setSantriPage(1);
                    }}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2 py-1.5 rounded-none text-gray-800 dark:text-gray-200 focus:outline-hidden cursor-pointer"
                  >
                    <option value="name_asc">Nama Santri (A-Z)</option>
                    <option value="orders_desc">Pesanan Selesai Terbanyak</option>
                    <option value="spent_desc">Total Belanja Tertinggi</option>
                    <option value="penalty_desc">Poin Penalti Terbanyak</option>
                    <option value="balance_desc">Saldo Tertinggi</option>
                  </select>
                </div>
              </div>

              {/* Baris 2 Filter: Filter Jenjang, Kelas & Kamar (Sesuai Urutan Hirarki) */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                {/* 1. Filter Jenjang */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">Jenjang:</span>
                  <select
                    value={santriLevel}
                    onChange={(e) => {
                      setSantriLevel(e.target.value);
                      setSantriClass('all'); // Otomatis reset kelas saat ganti jenjang
                      setSantriPage(1);
                    }}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2 py-1 rounded-none text-gray-800 dark:text-gray-200 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="all">Semua Jenjang</option>
                    {santriResponse?.filter_options?.levels?.map((lvl, idx) => (
                      <option key={idx} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Filter Kelas (Otomatis menyesuaikan jenjang yang dipilih) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">Kelas:</span>
                  <select
                    value={santriClass}
                    onChange={(e) => {
                      setSantriClass(e.target.value);
                      setSantriPage(1);
                    }}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2 py-1 rounded-none text-gray-800 dark:text-gray-200 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="all">
                      {santriLevel !== 'all' ? `Semua Kelas ${santriLevel}` : 'Semua Kelas'}
                    </option>
                    {(santriLevel !== 'all' && santriResponse?.filter_options?.level_classes_map?.[santriLevel]
                      ? santriResponse.filter_options.level_classes_map[santriLevel]
                      : santriResponse?.filter_options?.classes || []
                    ).map((cls, idx) => (
                      <option key={idx} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Filter Kamar */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">Kamar:</span>
                  <select
                    value={santriRoom}
                    onChange={(e) => {
                      setSantriRoom(e.target.value);
                      setSantriPage(1);
                    }}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2 py-1 rounded-none text-gray-800 dark:text-gray-200 focus:outline-hidden cursor-pointer max-w-[140px] truncate"
                  >
                    <option value="all">Semua Kamar</option>
                    {santriResponse?.filter_options?.rooms?.map((rm, idx) => (
                      <option key={idx} value={rm}>{rm}</option>
                    ))}
                  </select>
                </div>

                <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  <span>Ditemukan: <strong className="text-gray-900 dark:text-gray-100">{santriResponse?.santri?.total || 0}</strong> santri</span>
                  {(santriSearch || santriLevel !== 'all' || santriClass !== 'all' || santriRoom !== 'all' || santriSort !== 'name_asc') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSantriSearch('');
                        setSantriLevel('all');
                        setSantriClass('all');
                        setSantriRoom('all');
                        setSantriSort('name_asc');
                        setSantriPage(1);
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer text-[10px] font-bold"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabel Santri Terstruktur Flat Sharp */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-2.5 w-10 text-center">No</th>
                      <th className="py-2.5 px-2.5">Nama Santri & Wali</th>
                      <th className="py-2.5 px-2.5">Kamar & Kelas</th>
                      <th className="py-2.5 px-2.5 text-center">Poin Disiplin</th>
                      <th className="py-2.5 px-2.5 text-right">Pesanan Selesai</th>
                      <th className="py-2.5 px-2.5 text-right">Total Belanja</th>
                      <th className="py-2.5 px-2.5 text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {loadingSantri ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-gray-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent animate-spin rounded-full" />
                            <span>Memuat data seluruh santri...</span>
                          </div>
                        </td>
                      </tr>
                    ) : santriResponse?.santri?.data?.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-gray-400">
                          Tidak ada data santri yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      santriResponse?.santri?.data?.map((s, idx) => {
                        const rowNo = ((santriResponse.santri.current_page - 1) * santriResponse.santri.per_page) + idx + 1;
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 px-2.5 text-center font-mono text-gray-400 text-xs">
                              {rowNo}
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                                  {s.santri_name}
                                </span>
                                {s.gender && (
                                  <span className="text-[9px] text-gray-400 px-1 py-0.2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none font-mono">
                                    {s.gender === 'Laki-laki' ? 'Putra' : 'Putri'}
                                  </span>
                                )}
                                {s.accounts_count === 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 text-[9px] font-bold rounded-none">
                                    Belum Ada Akun
                                  </span>
                                ) : s.accounts_count === 1 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[9px] font-bold rounded-none">
                                    1 Akun Terhubung
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[9px] font-bold rounded-none">
                                    <Users className="w-2.5 h-2.5" />
                                    <span>{s.accounts_count} Akun Terpasang</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {s.accounts_count > 0 ? (
                                  <span>
                                    Wali: {s.linked_accounts?.map(a => a.name).slice(0, 2).join(', ')}{s.accounts_count > 2 ? '...' : ''}
                                  </span>
                                ) : (
                                  <span>No. WA: {s.phone || '-'}</span>
                                )}
                                {s.nis && s.nis !== '-' && (
                                  <span className="ml-1 text-gray-400 font-mono">• NIS: {s.nis}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {s.santri_room || '-'}
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                Kelas: {s.santri_class || '-'} {s.santri_level ? `(${s.santri_level})` : ''} {s.program ? `• ${s.program}` : ''}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              <span className={`inline-block px-1.5 py-0.2 text-[9.5px] font-bold font-mono rounded-none border ${
                                (s.penalty_points || 0) > 0
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300'
                              }`}>
                                {s.penalty_points || 0} Poin
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                              {(s.completed_orders_count || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">
                              Rp {Number(s.total_spent || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSantriId(s.id);
                                  setIsSantriModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950/60 hover:bg-green-600 hover:text-white dark:hover:bg-green-600 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[10.5px] font-bold rounded-none transition-colors cursor-pointer"
                                title="Lihat detail lengkap santri"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Detail</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginasi Santri */}
              {santriResponse?.santri?.last_page > 1 && (
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div className="text-gray-500 font-mono text-[11px]">
                    Halaman {santriResponse.santri.current_page} dari {santriResponse.santri.last_page} ({santriResponse.santri.total} santri)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={santriResponse.santri.current_page <= 1}
                      onClick={() => setSantriPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-none font-bold"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={santriResponse.santri.current_page >= santriResponse.santri.last_page}
                      onClick={() => setSantriPage((p) => p + 1)}
                      className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-none font-bold"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL DETAIL SANTRI KOMPAK & FLAT SHARP */}
        {isSantriModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-lg rounded-none shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header Modal Ramping */}
              <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-none border border-green-200 dark:border-green-800">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-gray-100">
                      Detail Data & Profil Santri
                    </h2>
                    <p className="text-[10px] text-gray-500">Informasi identitas, kamar, audit transaksi & pesanan</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSantriModalOpen(false);
                    setSelectedSantriId(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none cursor-pointer"
                  title="Tutup dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal Scrollable */}
              <div className="p-3.5 overflow-y-auto space-y-3">
                {loadingSantriDetail ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <div className="w-6 h-6 border-2 border-green-600 border-t-transparent animate-spin rounded-full mx-auto" />
                    <p className="text-xs">Memuat rincian data santri...</p>
                  </div>
                ) : !santriDetailData?.santri ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    Data santri tidak ditemukan atau telah dihapus.
                  </div>
                ) : (
                  <>
                    {/* Kartu Profil Utama Santri */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-none space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-gray-900 dark:text-gray-100">
                              {santriDetailData.santri.santri_name}
                            </span>
                            {santriDetailData.santri.gender && (
                              <span className="text-[9.5px] px-1 py-0.2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono text-gray-600 dark:text-gray-300">
                                {santriDetailData.santri.gender}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {santriDetailData.santri.nis && santriDetailData.santri.nis !== '-' && (
                              <span className="font-mono">NIS: <strong>{santriDetailData.santri.nis}</strong> • </span>
                            )}
                            {santriDetailData.santri.nisn && santriDetailData.santri.nisn !== '-' && (
                              <span className="font-mono">NISN: {santriDetailData.santri.nisn} • </span>
                            )}
                            <span>{santriDetailData.santri.program ? `Program: ${santriDetailData.santri.program}` : ''}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-none border ${
                          (santriDetailData.santri.penalty_points || 0) > 0
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
                            : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300'
                        }`}>
                          Disiplin: {santriDetailData.santri.penalty_points || 0} Poin
                        </span>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">Kamar / Asrama</span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {santriDetailData.santri.santri_room || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">Kelas & Jenjang</span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {santriDetailData.santri.santri_class || '-'} {santriDetailData.santri.santri_level ? `(${santriDetailData.santri.santri_level})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">No WhatsApp Santri / Wali</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">
                            {santriDetailData.santri.phone || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase font-bold">Status Akun Terpasang</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {santriDetailData.linked_accounts?.length || 0} Akun Terdaftar
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ringkasan Statistik Finansial Santri */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none text-center">
                        <span className="text-[9.5px] text-gray-400 font-bold block uppercase">Saldo Dompet</span>
                        <span className="text-xs font-mono font-black text-green-600 dark:text-green-400">
                          Rp {Number(santriDetailData.santri.total_balance ?? santriDetailData.santri.balance ?? 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none text-center">
                        <span className="text-[9.5px] text-gray-400 font-bold block uppercase">Pesanan Selesai</span>
                        <span className="text-xs font-mono font-black text-gray-800 dark:text-gray-100">
                          {santriDetailData.santri.completed_orders_count || 0}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none text-center">
                        <span className="text-[9.5px] text-gray-400 font-bold block uppercase">Total Belanja</span>
                        <span className="text-xs font-mono font-black text-green-600 dark:text-green-400">
                          Rp {Number(santriDetailData.santri.total_spent || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Seluruh Akun Terpasang pada Santri Ini */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden">
                      <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>Akun Terpasang pada Santri Ini ({santriDetailData.linked_accounts?.length || 0} Akun)</span>
                        </span>
                        <span className="text-[9.5px] text-gray-400 font-mono">Multi-Wali / Akun</span>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {(!santriDetailData.linked_accounts || santriDetailData.linked_accounts.length === 0) ? (
                          <div className="p-3 text-center text-gray-400 text-xs">
                            Belum ada akun wali/pengguna aplikasi yang terpasang pada santri ini.
                          </div>
                        ) : (
                          santriDetailData.linked_accounts.map((acc) => {
                            const isCurrent = acc.id === santriDetailData.santri.id;
                            return (
                              <div 
                                key={acc.id} 
                                className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                                  isCurrent 
                                    ? 'bg-blue-50/50 dark:bg-blue-950/30' 
                                    : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                                    <span>{acc.name}</span>
                                    {isCurrent && (
                                      <span className="text-[9px] px-1 py-0.2 bg-blue-600 text-white font-bold rounded-none">
                                        Akun Utama
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5 mt-0.5">
                                    <span>HP: {acc.phone || '-'}</span>
                                    <span>•</span>
                                    <span className="truncate max-w-[140px]">{acc.email || '-'}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <div className="text-[10px] text-gray-500">
                                    Pesanan: <strong className="font-mono text-gray-800 dark:text-gray-200">{acc.completed_orders_count || 0}</strong>
                                  </div>
                                  <div className="font-mono font-bold text-green-600 dark:text-green-400 text-xs">
                                    Rp {Number(acc.total_spent || 0).toLocaleString('id-ID')}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 5 Riwayat Pesanan Terakhir */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden">
                      <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3 text-green-600" />
                          <span>5 Pesanan Terakhir Santri</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">Riwayat Transaksi</span>
                      </div>

                      {santriDetailData.recent_orders?.length === 0 ? (
                        <div className="py-4 text-center text-gray-400 text-xs">
                          Santri ini belum memiliki riwayat pesanan.
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {santriDetailData.recent_orders?.map((ord) => (
                            <div key={ord.id} className="p-2 flex items-center justify-between text-xs hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                              <div>
                                <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
                                  <span>Order #{ord.id}</span>
                                  <span className="text-[10px] text-gray-400">• {ord.canteen?.name || 'Kantin'}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono">
                                  {formatDate(ord.created_at)}
                                </div>
                                {ord.items?.length > 0 && (
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    {ord.items.map((it) => `${it.product?.name || 'Item'} (${it.quantity}x)`).join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <div className="font-mono font-bold text-gray-900 dark:text-gray-100">
                                  Rp {Number(ord.total_price || 0).toLocaleString('id-ID')}
                                </div>
                                <span className={`inline-block text-[9px] px-1 py-0.2 rounded-none font-bold uppercase ${
                                  ord.status === 'completed'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                    : ord.status === 'cancelled'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}>
                                  {ord.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer Modal Ramping */}
              <div className="px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsSantriModalOpen(false);
                    setSelectedSantriId(null);
                  }}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-none cursor-pointer transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
