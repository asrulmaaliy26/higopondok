import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { getStorageUrl } from '../../lib/axios';
import { 
  Store, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  Save, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Power, 
  Search, 
  X, 
  RefreshCw, 
  SlidersHorizontal,
  Wallet,
  User,
  Phone,
  Building2,
  GraduationCap,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Eye,
  EyeOff,
  UploadCloud,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppImage from '../../components/common/AppImage';
import { PRICING_CONFIG } from '../../config/pricing';

/**
 * =====================================================
 * KONFIGURASI ZONA TOKO — Ubah di sini untuk menambah
 * atau mengurangi zona. Semua tampilan zona di halaman
 * ini akan otomatis menyesuaikan.
 *
 * Format setiap zona:
 *   id          : nilai yang disimpan di database (string, lowercase)
 *   label       : nama tampilan
 *   deliveryFee : ongkir kurir (dalam rupiah)
 *   adminFee    : biaya admin (dalam rupiah)
 * =====================================================
 */
export const CANTEEN_ZONES = [
  { id: 'kauman', label: 'Zona Kauman', deliveryFee: 2000, adminFee: 1000 },
  { id: 'kota',   label: 'Zona Kota',   deliveryFee: PRICING_CONFIG.BASE_DELIVERY_FEE, adminFee: PRICING_CONFIG.BASE_ADMIN_FEE },
];

/** Helper: cari objek zona berdasarkan id */
const getZone = (id) => CANTEEN_ZONES.find(z => z.id === id) ?? CANTEEN_ZONES[0];

/** Format angka ke Rp X.XXX */
const rp = (n) => `Rp ${n.toLocaleString('id-ID')}`;

export default function Pertokoan() {
  const queryClient = useQueryClient();
  
  // Selected detail canteen modal
  const [selectedCanteen, setSelectedCanteen] = useState(null);
  
  // Quick Hours Edit modal for a single canteen
  const [quickHoursCanteen, setQuickHoursCanteen] = useState(null);
  const [quickOpenTime, setQuickOpenTime] = useState('08:00');
  const [quickCloseTime, setQuickCloseTime] = useState('22:00');

  // Bulk Hours Edit modal
  const [isBulkHoursModalOpen, setIsBulkHoursModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('all');
  const [bulkOpenTime, setBulkOpenTime] = useState('06:00');
  const [bulkCloseTime, setBulkCloseTime] = useState('23:59');
  const [bulkReopenForceClosed, setBulkReopenForceClosed] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // all, open, schedule_closed, force_closed, pending, kauman, kota

  // Detail Modal specific states
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [detailOpenTime, setDetailOpenTime] = useState('');
  const [detailCloseTime, setDetailCloseTime] = useState('');
  const [detailCategory, setDetailCategory] = useState('kauman');

  // Banner Management states for selected canteen
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerFile, setNewBannerFile] = useState(null);
  const [newBannerPreview, setNewBannerPreview] = useState(null);

  // 1. Fetch Canteens List
  const { data: canteens, isLoading } = useQuery({
    queryKey: ['admin-canteens'],
    queryFn: async () => {
      const res = await axios.get('/admin/canteens');
      return res.data.data || res.data;
    }
  });

  // 2. Fetch Global Emergency Status
  const { data: globalStatus } = useQuery({
    queryKey: ['admin-canteens-status'],
    queryFn: async () => {
      const res = await axios.get('/admin/canteens/status');
      return res.data;
    }
  });

  const isGlobalForceClosed = Boolean(globalStatus?.is_global_force_closed);

  const invalidateAllCanteenQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-canteens'] });
    queryClient.invalidateQueries({ queryKey: ['admin-canteens-status'] });
    queryClient.invalidateQueries({ queryKey: ['canteens'] });
    queryClient.invalidateQueries({ queryKey: ['public_canteens_list'] });
    queryClient.invalidateQueries({ queryKey: ['my_canteens_list'] });
    queryClient.invalidateQueries({ queryKey: ['banners'] });
  };

  // --- MUTATIONS ---

  // Bulk Close Mutation (Master Switch Close)
  const bulkCloseMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/admin/canteens/bulk-close');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Semua toko berhasil ditutup langsung!');
      invalidateAllCanteenQueries();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menutup semua toko');
    }
  });

  // Bulk Open Mutation (Master Switch Open)
  const bulkOpenMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/admin/canteens/bulk-open', { reset_all: true });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Semua toko berhasil dibuka kembali (mengikuti jadwal operasional)!');
      invalidateAllCanteenQueries();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal membuka semua toko');
    }
  });

  // Bulk Update Operating Hours Mutation
  const bulkUpdateHoursMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.post('/admin/canteens/bulk-hours', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Jam operasional massal berhasil diperbarui!');
      invalidateAllCanteenQueries();
      setIsBulkHoursModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui jam operasional massal');
    }
  });

  // Toggle Direct Close for a Single Canteen
  const toggleDirectCloseMutation = useMutation({
    mutationFn: async ({ id, force_close }) => {
      const res = await axios.put(`/admin/canteens/${id}/toggle-direct-close`, { force_close });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Status penutupan toko berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah status penutupan toko');
    }
  });

  // Update Single Canteen Operating Hours
  const updateHoursMutation = useMutation({
    mutationFn: async ({ id, open_time, close_time }) => {
      const res = await axios.put(`/admin/canteens/${id}/hours`, { open_time, close_time });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Jam operasional berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
      setQuickHoursCanteen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui jam operasional');
    }
  });

  // Approve Canteen Mutation
  const approveCanteenMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.post(`/admin/canteens/${id}/approve`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Kantin berhasil disetujui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    }
  });

  // Reject Canteen Mutation
  const rejectCanteenMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.post(`/admin/canteens/${id}/reject`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Izin kantin dinonaktifkan');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    }
  });

  // Update Category & Fees
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }) => {
      const res = await axios.put(`/admin/canteens/${id}/fees`, { category });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Zona lokasi & tarif berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah tarif zona');
    }
  });

  // Withdraw Canteen Balance
  const withdrawMutation = useMutation({
    mutationFn: async ({ id, amount, notes }) => {
      const res = await axios.post(`/admin/canteens/${id}/withdraw`, { amount, notes });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pencairan dana berhasil diproses');
      invalidateAllCanteenQueries();
      setWithdrawalAmount('');
      setWithdrawalNotes('');
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memproses pencairan dana');
    }
  });

  // --- BANNER MUTATIONS ---
  const uploadBannerMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axios.post(`/canteen/banners?canteen_id=${selectedCanteen.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Banner toko berhasil ditambahkan');
      invalidateAllCanteenQueries();
      setNewBannerTitle('');
      setNewBannerFile(null);
      setNewBannerPreview(null);
      if (selectedCanteen && data.banner) {
        setSelectedCanteen(prev => prev ? ({
          ...prev,
          banners: [data.banner, ...(prev.banners || [])]
        }) : null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah banner toko');
    }
  });

  const toggleBannerStatusMutation = useMutation({
    mutationFn: async (bannerId) => {
      const res = await axios.put(`/canteen/banners/${bannerId}/status`);
      return res.data;
    },
    onSuccess: (data, bannerId) => {
      toast.success(data.message || 'Status tayang banner berhasil diubah');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.banners) {
        setSelectedCanteen(prev => prev ? ({
          ...prev,
          banners: prev.banners.map(b => b.id === bannerId ? { ...b, status: b.status === 'active' ? 'inactive' : 'active' } : b)
        }) : null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah status banner');
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId) => {
      const res = await axios.delete(`/canteen/banners/${bannerId}`);
      return res.data;
    },
    onSuccess: (data, bannerId) => {
      toast.success(data.message || 'Banner toko berhasil dihapus');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.banners) {
        setSelectedCanteen(prev => prev ? ({
          ...prev,
          banners: prev.banners.filter(b => b.id !== bannerId)
        }) : null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus banner');
    }
  });

  const handleBannerFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error('Ukuran file banner maksimal 3MB');
        return;
      }
      setNewBannerFile(file);
      setNewBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadBannerSubmit = (e) => {
    e.preventDefault();
    if (!selectedCanteen) return;
    if (!newBannerFile) {
      toast.error('Pilih gambar banner terlebih dahulu');
      return;
    }
    if (!newBannerTitle.trim()) {
      toast.error('Judul banner wajib diisi');
      return;
    }

    const formData = new FormData();
    formData.append('title', newBannerTitle.trim());
    formData.append('image', newBannerFile);
    formData.append('canteen_id', selectedCanteen.id);

    uploadBannerMutation.mutate(formData);
  };

  // --- HANDLERS ---
  const handleOpenDetail = (canteen) => {
    setSelectedCanteen(canteen);
    setDetailCategory(canteen.category || 'kauman');
    setDetailOpenTime(canteen.open_time?.substring(0, 5) || '08:00');
    setDetailCloseTime(canteen.close_time?.substring(0, 5) || '22:00');
    setWithdrawalAmount('');
    setWithdrawalNotes('');
    setNewBannerTitle('');
    setNewBannerFile(null);
    setNewBannerPreview(null);
  };

  const handleOpenQuickHours = (e, canteen) => {
    e.stopPropagation();
    setQuickHoursCanteen(canteen);
    setQuickOpenTime(canteen.open_time?.substring(0, 5) || '08:00');
    setQuickCloseTime(canteen.close_time?.substring(0, 5) || '22:00');
  };

  const handleDirectToggleClose = (e, canteen) => {
    e.stopPropagation();
    const isCurrentlyForceClosed = canteen.is_force_closed;
    const confirmMsg = isCurrentlyForceClosed
      ? `Buka kembali toko "${canteen.name}" agar beroperasi sesuai jam (${canteen.open_time?.substring(0,5) || '08:00'} - ${canteen.close_time?.substring(0,5) || '22:00'})?`
      : `Tutup langsung toko "${canteen.name}" sekarang juga? Santri tidak dapat memesan hingga toko dibuka kembali.`;
    
    if (window.confirm(confirmMsg)) {
      toggleDirectCloseMutation.mutate({
        id: canteen.id,
        force_close: !isCurrentlyForceClosed
      });
    }
  };

  const handleBulkClose = () => {
    if (window.confirm('⚠️ PERINGATAN DARURAT: Apakah Anda yakin ingin MENUTUP SELURUH TOKO secara langsung? Seluruh toko akan ditutup seketika dan santri tidak dapat memesan.')) {
      bulkCloseMutation.mutate();
    }
  };

  const handleBulkOpen = () => {
    if (window.confirm('Aktifkan dan Buka kembali semua toko agar beroperasi sesuai jadwal jam operasional masing-masing?')) {
      bulkOpenMutation.mutate();
    }
  };

  const handleSaveBulkHours = (e) => {
    e.preventDefault();
    const categoryName = bulkCategory === 'all'
      ? 'Semua Toko'
      : getZone(bulkCategory).label;
    if (window.confirm(`Terapkan jam operasional ${bulkOpenTime} - ${bulkCloseTime} ke ${categoryName}?`)) {
      bulkUpdateHoursMutation.mutate({
        open_time: bulkOpenTime,
        close_time: bulkCloseTime,
        category: bulkCategory,
        reopen_force_closed: bulkReopenForceClosed
      });
    }
  };

  // --- STATS CALCULATION ---
  const canteensList = Array.isArray(canteens) ? canteens : [];
  const totalCount = canteensList.length;
  const openCount = canteensList.filter(c => c.status === 'approved' && c.is_open).length;
  const forceClosedCount = canteensList.filter(c => c.status === 'approved' && c.is_force_closed).length;
  const scheduleClosedCount = canteensList.filter(c => c.status === 'approved' && !c.is_open && !c.is_force_closed).length;
  const pendingCount = canteensList.filter(c => c.status === 'pending').length;
  const withBannerCount = canteensList.filter(c => c.banners && c.banners.length > 0).length;
  const withoutBannerCount = totalCount - withBannerCount;

  // --- FILTERED CANTEENS ---
  const filteredCanteens = canteensList.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'open') return c.status === 'approved' && c.is_open;
    if (filterTab === 'force_closed') return c.status === 'approved' && c.is_force_closed;
    if (filterTab === 'schedule_closed') return c.status === 'approved' && !c.is_open && !c.is_force_closed;
    if (filterTab === 'pending') return c.status === 'pending';
    if (filterTab === 'has_banner') return Boolean(c.banners && c.banners.length > 0);
    if (filterTab === 'no_banner') return !c.banners || c.banners.length === 0;
    // Filter zona dinamis dari CANTEEN_ZONES
    if (CANTEEN_ZONES.some(z => z.id === filterTab)) return c.category === filterTab;
    return true;
  });

  return (
    <>
      <div className="space-y-2 animate-fade-in-up pb-20 max-w-7xl mx-auto px-1 sm:px-2">
        
        {/* UNIFIED COMPACT HEADER & MASTER ACTIONS */}
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Left Title Info */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-none bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                  Manajemen Toko & Jam Operasional
                </h1>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-none text-[10px] font-bold border border-gray-200 dark:border-gray-700">
                  Total {totalCount}
                </span>
                <span className="text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/80 px-1.5 py-0.5 rounded-none border border-green-200 dark:border-green-800 hidden sm:inline-block">
                  Live Realtime
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                Kelola status buka/tutup, jam operasional massal, serta zona tarif toko langsung.
              </p>
            </div>
          </div>

          {/* Right: Master Control Actions Bar (Inline & Sleek) */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Action 1: Atur Jam Semua Toko */}
            <button
              type="button"
              onClick={() => setIsBulkHoursModalOpen(true)}
              className="px-2.5 py-1 rounded-none font-bold text-xs flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Clock className="w-3 h-3" />
              <span>Atur Jam Semua</span>
            </button>

            {/* Action 2: Buka Semua (Ikuti Jadwal) */}
            <button
              type="button"
              onClick={handleBulkOpen}
              disabled={bulkOpenMutation.isPending}
              className="px-2.5 py-1 rounded-none font-bold text-xs flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
              <span>{bulkOpenMutation.isPending ? 'Membuka...' : 'Buka Semua'}</span>
            </button>

            {/* Action 3: Tutup Semua Toko Darurat */}
            <button
              type="button"
              onClick={handleBulkClose}
              disabled={bulkCloseMutation.isPending || isGlobalForceClosed}
              className={`px-2.5 py-1 rounded-none font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isGlobalForceClosed 
                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border border-transparent cursor-not-allowed'
                  : 'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              <Power className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span>{bulkCloseMutation.isPending ? 'Menutup...' : 'Tutup Semua'}</span>
            </button>
          </div>
        </div>

        {/* EMERGENCY ALERT (If All Stores Closed) */}
        {isGlobalForceClosed && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-none p-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-red-700 dark:text-red-300">
                  Seluruh Toko Sedang Ditutup Langsung oleh Admin
                </h4>
                <p className="text-[10px] text-red-600 dark:text-red-400">
                  Santri tidak dapat membuat pesanan di semua toko saat ini.
                </p>
              </div>
            </div>
            <button
              onClick={handleBulkOpen}
              disabled={bulkOpenMutation.isPending}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-none shadow-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${bulkOpenMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Buka Kembali Semua Toko</span>
            </button>
          </div>
        )}

        {/* STATUS COUNTER CARDS (Interactive Filter) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          
          {/* Card: Sedang Buka */}
          <div 
            onClick={() => setFilterTab('open')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'open' 
                ? 'bg-green-50 dark:bg-green-950/40 border-green-500 ring-1 ring-green-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sedang Buka</span>
              <div className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">{openCount}</p>
              <span className="text-[9px] text-gray-400">Terima order</span>
            </div>
          </div>

          {/* Card: Tutup Jadwal */}
          <div 
            onClick={() => setFilterTab('schedule_closed')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'schedule_closed' 
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-500 ring-1 ring-gray-400' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tutup Jadwal</span>
              <div className="w-1.5 h-1.5 rounded-none bg-gray-400"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-gray-700 dark:text-gray-300 font-mono leading-none">{scheduleClosedCount}</p>
              <span className="text-[9px] text-gray-400">Di luar jam buka</span>
            </div>
          </div>

          {/* Card: Tutup Langsung */}
          <div 
            onClick={() => setFilterTab('force_closed')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'force_closed' 
                ? 'bg-red-50 dark:bg-red-950/40 border-red-500 ring-1 ring-red-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tutup Langsung</span>
              <div className="w-1.5 h-1.5 rounded-none bg-red-500"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 font-mono leading-none">{forceClosedCount}</p>
              <span className="text-[9px] text-gray-400">Kunci admin</span>
            </div>
          </div>

          {/* Card: Pasang Banner Promosi */}
          <div 
            onClick={() => setFilterTab(filterTab === 'has_banner' ? 'all' : 'has_banner')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'has_banner' 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pasang Banner</span>
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">{withBannerCount}</p>
              <span className="text-[9px] text-gray-400">{withBannerCount} dari {totalCount} toko</span>
            </div>
          </div>

          {/* Card: Menunggu Review */}
          <div 
            onClick={() => setFilterTab('pending')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'pending' 
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Review Baru</span>
              <div className="w-1.5 h-1.5 rounded-none bg-amber-500"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono leading-none">{pendingCount}</p>
              <span className="text-[9px] text-gray-400">Pengajuan toko</span>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-1.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari toko, pemilik, atau kamar santri..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none shadow-xs focus:ring-1 focus:ring-green-500 focus:border-green-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-none cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Pills Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-0.5 text-xs font-bold">
            {[
              { id: 'all', label: `Semua (${totalCount})` },
              { id: 'has_banner', label: `🖼️ Ada Banner (${withBannerCount})` },
              { id: 'no_banner', label: `Tanpa Banner (${withoutBannerCount})` },
              { id: 'open', label: `Buka (${openCount})` },
              { id: 'schedule_closed', label: `Tutup Jadwal (${scheduleClosedCount})` },
              { id: 'force_closed', label: `Tutup Langsung (${forceClosedCount})` },
              ...CANTEEN_ZONES.map(z => ({ id: z.id, label: z.label })),
              { id: 'pending', label: `Review (${pendingCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-2 py-1 rounded-none whitespace-nowrap transition-all cursor-pointer text-[11px] ${
                  filterTab === tab.id
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CANTEEN CARDS GRID */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-none"></div>
              ))}
            </div>
          ) : filteredCanteens.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5">
              {filteredCanteens.map((canteen) => {
                const isKota = canteen.category === 'kota';
                const openFormatted = canteen.open_time?.substring(0, 5) || '08:00';
                const closeFormatted = canteen.close_time?.substring(0, 5) || '22:00';

                return (
                  <div 
                    key={canteen.id} 
                    className="bg-white dark:bg-gray-900 rounded-none p-2 border border-gray-200 dark:border-gray-800 shadow-2xs hover:border-green-500 dark:hover:border-green-600 transition-all flex flex-col justify-between gap-1 relative overflow-hidden group"
                  >
                    {/* Upper Row: Image, Store Name, Zone, Owner, Balance */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-7 h-7 rounded-none bg-green-50 dark:bg-green-950/50 border border-green-100 dark:border-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0 overflow-hidden relative">
                          {canteen.image ? (
                            <AppImage src={canteen.image} alt={canteen.name} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate leading-tight">
                              {canteen.name}
                            </h3>
                            <span className={`px-1 py-0.2 text-[8px] font-bold rounded-none border shrink-0 ${
                              isKota 
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            }`}>
                              {isKota ? 'Kota' : 'Kauman'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-0.5 leading-none">
                              <User className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                              <span className="truncate">{canteen.user?.name || '-'}</span>
                            </p>
                            {canteen.banners && canteen.banners.length > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[7.5px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-none shrink-0" title="Toko ini sudah memasang banner promosi">
                                <Sparkles className="w-2 h-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Banner ({canteen.banners.length})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1 py-0.2 text-[7.5px] font-medium bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-none shrink-0" title="Belum pasang banner">
                                Tanpa Banner
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Saldo Badge */}
                      <div className="flex flex-col items-end shrink-0 bg-gray-50 dark:bg-gray-800/60 px-1.5 py-0.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                        <span className="text-[7px] font-semibold text-gray-400 uppercase leading-none">Saldo</span>
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                          Rp {parseFloat(canteen.balance || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Operational Status Badge & Action Buttons */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-1 min-w-0">
                        {canteen.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-bold rounded-none border border-amber-200 dark:border-amber-800 truncate">
                            <span className="w-1.5 h-1.5 rounded-none bg-amber-500 animate-pulse shrink-0"></span>
                            Review
                          </span>
                        ) : canteen.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[9px] font-bold rounded-none truncate">
                            <XCircle className="w-2.5 h-2.5 shrink-0" />
                            Nonaktif
                          </span>
                        ) : canteen.is_force_closed ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 text-[9px] font-bold rounded-none border border-red-200 dark:border-red-800 truncate">
                            <Power className="w-2.5 h-2.5 text-red-600 shrink-0" />
                            Tutup Paksa
                          </span>
                        ) : canteen.is_open ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[9px] font-bold rounded-none border border-emerald-200 dark:border-emerald-800 truncate">
                            <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse shrink-0"></span>
                            Buka ({openFormatted}-{closeFormatted})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[9px] font-semibold rounded-none border border-gray-200 dark:border-gray-700 truncate">
                            <Clock className="w-2.5 h-2.5 text-gray-500 shrink-0" />
                            Tutup ({openFormatted}-{closeFormatted})
                          </span>
                        )}
                      </div>

                      {/* Action Buttons Group */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Direct Approve Canteen Button if Pending */}
                        {canteen.status === 'pending' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Setujui pendaftaran toko "${canteen.name}" sekarang?`)) {
                                approveCanteenMutation.mutate(canteen.id);
                              }
                            }}
                            disabled={approveCanteenMutation.isPending}
                            title="Setujui toko ini agar mulai aktif berjualan"
                            className="px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-[10px] font-bold flex items-center gap-0.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle size={10} />
                            <span>{approveCanteenMutation.isPending ? '...' : 'Setujui'}</span>
                          </button>
                        )}

                        {/* Direct Toggle Close / Open */}
                        {canteen.status === 'approved' && (
                          <button
                            type="button"
                            onClick={(e) => handleDirectToggleClose(e, canteen)}
                            disabled={toggleDirectCloseMutation.isPending}
                            title={canteen.is_force_closed ? 'Buka toko kembali' : 'Tutup toko sekarang'}
                            className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-0.5 transition-all shadow-xs cursor-pointer ${
                              canteen.is_force_closed
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
                            }`}
                          >
                            <Power className="w-2.5 h-2.5" />
                            <span>{canteen.is_force_closed ? 'Buka' : 'Tutup'}</span>
                          </button>
                        )}

                        {/* Banner Management Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(canteen)}
                          title={canteen.banners?.length > 0 ? `Kelola ${canteen.banners.length} banner toko ini` : 'Unggah banner promosi untuk toko ini'}
                          className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-0.5 transition-colors border cursor-pointer ${
                            canteen.banners?.length > 0
                              ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>Banner{canteen.banners?.length > 0 ? ` (${canteen.banners.length})` : ''}</span>
                        </button>

                        {/* Quick Edit Hours */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenQuickHours(e, canteen)}
                          title="Atur jam buka/tutup toko ini"
                          className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-none text-[10px] font-bold flex items-center gap-0.5 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
                        >
                          <Clock className="w-2.5 h-2.5 text-gray-500" />
                          <span>Jam</span>
                        </button>

                        {/* Full Detail */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(canteen)}
                          className="px-2 py-0.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/60 rounded-none text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 p-6 flex flex-col items-center justify-center rounded-none border border-dashed border-gray-200 dark:border-gray-700 text-center shadow-xs">
              <Store className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-1.5" />
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200">Tidak ada toko ditemukan</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">
                {searchTerm ? 'Coba ubah kata kunci pencarian Anda.' : 'Belum ada data toko pada kategori ini.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: ATUR JAM SEMUA TOKO (BULK HOURS MODAL) --- */}
      {isBulkHoursModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md p-3.5 sm:p-4 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3 my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center border border-green-300 dark:border-green-800">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Atur Jam Semua Toko</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Terapkan jadwal buka/tutup serentak</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBulkHoursModalOpen(false)}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBulkHours} className="space-y-3 text-xs">
              {/* Target Zona */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-[11px]">
                  Terapkan ke Kategori Toko:
                </label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-2 font-bold text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-green-500"
                >
                  <option value="all">Semua Toko ({totalCount} Toko)</option>
                  {CANTEEN_ZONES.map(z => (
                    <option key={z.id} value={z.id}>Hanya {z.label}</option>
                  ))}
                </select>
              </div>

              {/* Jam Buka & Jam Tutup */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                    Jam Buka
                  </label>
                  <input
                    type="time"
                    lang="id-ID"
                    value={bulkOpenTime}
                    onChange={(e) => setBulkOpenTime(e.target.value)}
                    required
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                  />
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                    Jam Tutup
                  </label>
                  <input
                    type="time"
                    lang="id-ID"
                    value={bulkCloseTime}
                    onChange={(e) => setBulkCloseTime(e.target.value)}
                    required
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                  />
                </div>
              </div>

              {/* Checkbox Reopen */}
              <label className="flex items-start gap-2 p-2 rounded-none bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkReopenForceClosed}
                  onChange={(e) => setBulkReopenForceClosed(e.target.checked)}
                  className="mt-0.5 rounded-none text-green-600 focus:ring-green-500"
                />
                <span className="text-[11px] text-green-900 dark:text-green-300 font-medium leading-tight">
                  Buka kembali toko yang sedang dalam status <strong>Tutup Langsung</strong> agar langsung aktif mengikuti jam baru ini.
                </span>
              </label>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsBulkHoursModalOpen(false)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 text-gray-700 font-bold text-xs rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bulkUpdateHoursMutation.isPending}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  <span>{bulkUpdateHoursMutation.isPending ? 'Menerapkan...' : 'Terapkan Jam'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL 2: QUICK EDIT JAM 1 TOKO --- */}
      {quickHoursCanteen && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-sm p-3.5 sm:p-4 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3 my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Atur Jam Toko</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{quickHoursCanteen.name}</p>
              </div>
              <button 
                onClick={() => setQuickHoursCanteen(null)}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateHoursMutation.mutate({
                  id: quickHoursCanteen.id,
                  open_time: quickOpenTime,
                  close_time: quickCloseTime
                });
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                    Jam Buka
                  </label>
                  <input
                    type="time"
                    lang="id-ID"
                    value={quickOpenTime}
                    onChange={(e) => setQuickOpenTime(e.target.value)}
                    required
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                  />
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                    Jam Tutup
                  </label>
                  <input
                    type="time"
                    lang="id-ID"
                    value={quickCloseTime}
                    onChange={(e) => setQuickCloseTime(e.target.value)}
                    required
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickHoursCanteen(null)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updateHoursMutation.isPending}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  <span>{updateHoursMutation.isPending ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL 3: DETAIL TOKO LENGKAP (HIGH DENSITY & COMPACT GOBIZ STYLE) --- */}
      {selectedCanteen && createPortal(
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col animate-in slide-in-from-bottom-full duration-200 font-sans">
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <button 
                onClick={() => {
                  setSelectedCanteen(null);
                  setNewBannerTitle('');
                  setNewBannerFile(null);
                  setNewBannerPreview(null);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer shrink-0"
                title="Kembali"
              >
                <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
              <div className="min-w-0">
                <h2 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white truncate leading-tight">Detail & Pengaturan Toko</h2>
                <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold truncate leading-none mt-0.5">{selectedCanteen.name}</p>
              </div>
            </div>

            {/* Quick Status Pill in Header */}
            <div>
              {selectedCanteen.status === 'approved' && (
                <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-none border ${
                  selectedCanteen.is_force_closed 
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800' 
                    : selectedCanteen.is_open 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' 
                      : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}>
                  {selectedCanteen.is_force_closed ? 'Ditutup Admin' : selectedCanteen.is_open ? 'Buka' : 'Tutup Jadwal'}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 pb-16 space-y-2 max-w-2xl mx-auto w-full">
            
            {/* Quick Status & Action Bar */}
            <div className="p-2 sm:p-2.5 rounded-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 shadow-xs">
              <div className="min-w-0">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider block leading-tight">Status Operasional</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {selectedCanteen.status === 'pending' ? (
                    <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold rounded-none border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-none bg-amber-500 animate-pulse"></span>
                      Menunggu Review Admin
                    </span>
                  ) : selectedCanteen.status === 'rejected' ? (
                    <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-bold rounded-none border border-gray-300 dark:border-gray-700 flex items-center gap-1">
                      <XCircle size={11} className="text-red-500" />
                      Ditolak / Nonaktif
                    </span>
                  ) : selectedCanteen.is_force_closed ? (
                    <span className="px-1.5 py-0.2 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[10px] font-bold rounded-none border border-red-200 dark:border-red-800">
                      ● Ditutup Paksa oleh Admin
                    </span>
                  ) : selectedCanteen.is_open ? (
                    <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold rounded-none border border-emerald-200 dark:border-emerald-800">
                      ● Sedang Buka
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-semibold rounded-none border border-gray-200 dark:border-gray-700">
                      ● Tutup di Luar Jadwal
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Approve / Reject / Toggle Close */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedCanteen.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Setujui toko "${selectedCanteen.name}" sekarang?`)) {
                          approveCanteenMutation.mutate(selectedCanteen.id);
                        }
                      }}
                      disabled={approveCanteenMutation.isPending}
                      className="px-2.5 py-1 rounded-none text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle size={12} />
                      <span>{approveCanteenMutation.isPending ? '...' : 'Setujui'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Tolak pendaftaran toko "${selectedCanteen.name}"?`)) {
                          rejectCanteenMutation.mutate(selectedCanteen.id);
                        }
                      }}
                      disabled={rejectCanteenMutation.isPending}
                      className="px-2.5 py-1 rounded-none text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 border border-red-200 flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle size={12} />
                      <span>{rejectCanteenMutation.isPending ? '...' : 'Tolak'}</span>
                    </button>
                  </>
                )}

                {selectedCanteen.status === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Aktifkan kembali toko "${selectedCanteen.name}"?`)) {
                        approveCanteenMutation.mutate(selectedCanteen.id);
                      }
                    }}
                    disabled={approveCanteenMutation.isPending}
                    className="px-2.5 py-1 rounded-none text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle size={12} />
                    <span>{approveCanteenMutation.isPending ? '...' : 'Aktifkan Toko'}</span>
                  </button>
                )}

                {selectedCanteen.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      const willForceClose = !selectedCanteen.is_force_closed;
                      toggleDirectCloseMutation.mutate({
                        id: selectedCanteen.id,
                        force_close: willForceClose
                      });
                    }}
                    disabled={toggleDirectCloseMutation.isPending}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer ${
                      selectedCanteen.is_force_closed
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <Power size={12} />
                    <span>{selectedCanteen.is_force_closed ? 'Buka Toko' : 'Tutup Toko Ini Langsung'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Profil Pemilik Toko (High-Density 2x2 Grid) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Profil Pemilik Toko
              </h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9.5px] font-bold uppercase leading-tight">Nama Pemilik</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5">{selectedCanteen.user?.name || '-'}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9.5px] font-bold uppercase leading-tight">Nomor WhatsApp</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5">
                    {selectedCanteen.user?.phone ? (
                      <a href={`https://wa.me/${selectedCanteen.user.phone}`} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                        {selectedCanteen.user.phone}
                      </a>
                    ) : (
                      <span className="text-red-500 font-normal">Belum diisi</span>
                    )}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9.5px] font-bold uppercase leading-tight">Nama Santri</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5">{selectedCanteen.user?.santri_name || <span className="text-red-500 font-normal">Belum diisi</span>}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9.5px] font-bold uppercase leading-tight">Kamar / Asrama</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5">{selectedCanteen.user?.santri_room || <span className="text-red-500 font-normal">Belum diisi</span>}</span>
                </div>
              </div>
            </div>

            {/* Banner Promosi Toko di Beranda (High-Density & Flat Sharp) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Banner Promosi Toko (Beranda)
                </h3>
                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-none border ${
                  (selectedCanteen.banners?.length || 0) > 0 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
                    : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {(selectedCanteen.banners?.length || 0) > 0 ? `${selectedCanteen.banners.length} Banner Terpasang` : 'Belum Pasang Banner'}
                </span>
              </div>

              {/* Daftar Banner Terpasang */}
              {selectedCanteen.banners && selectedCanteen.banners.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedCanteen.banners.map((b) => (
                    <div 
                      key={b.id} 
                      className="p-1.5 bg-gray-50 dark:bg-gray-800/40 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-16 h-10 bg-gray-200 dark:bg-gray-700 rounded-none shrink-0 overflow-hidden border border-gray-300 dark:border-gray-600">
                          <AppImage src={b.image_path} alt={b.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{b.title}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1 py-0.2 text-[8px] font-bold rounded-none border ${
                              b.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {b.status === 'active' ? '● Tayang di Beranda' : '○ Disembunyikan'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleBannerStatusMutation.mutate(b.id)}
                          disabled={toggleBannerStatusMutation.isPending}
                          title={b.status === 'active' ? 'Sembunyikan banner dari beranda' : 'Tayangkan banner di beranda'}
                          className="px-2 py-1 text-[10px] font-bold rounded-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {b.status === 'active' ? (
                            <>
                              <EyeOff size={11} className="text-amber-600" />
                              <span className="text-[9.5px]">Sembunyikan</span>
                            </>
                          ) : (
                            <>
                              <Eye size={11} className="text-emerald-600" />
                              <span className="text-[9.5px]">Tayangkan</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus banner "${b.title}"?`)) {
                              deleteBannerMutation.mutate(b.id);
                            }
                          }}
                          disabled={deleteBannerMutation.isPending}
                          title="Hapus banner ini"
                          className="p-1 text-xs font-bold rounded-none border border-red-200 dark:border-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800/30 p-2 rounded-none border border-dashed border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Toko ini belum memasang banner promosi. Admin dapat mengunggah banner promosi di bawah agar tampil di beranda aplikasi santri.
                  </p>
                </div>
              )}

              {/* Form Upload Banner Baru */}
              <form onSubmit={handleUploadBannerSubmit} className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1">
                    <Plus size={11} className="text-green-600" /> Unggah Banner Baru untuk Toko Ini
                  </span>
                  <span className="text-[9px] text-gray-400">Rasio ~16:9 atau 21:9</span>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Judul / Promo banner (contoh: Promo Diskon 15% Menu Favorit)"
                    value={newBannerTitle}
                    onChange={(e) => setNewBannerTitle(e.target.value)}
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 text-xs font-medium text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleBannerFileChange}
                      className="hidden"
                    />
                    <div className="border border-dashed border-gray-300 dark:border-gray-700 hover:border-green-500 p-2 bg-gray-50 dark:bg-gray-800/40 text-center transition-colors">
                      {newBannerFile ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                          📁 {newBannerFile.name} ({(newBannerFile.size / 1024).toFixed(0)} KB)
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                          <UploadCloud size={13} className="text-gray-400" />
                          <span>Pilih Gambar Banner (Maks 3MB)</span>
                        </span>
                      )}
                    </div>
                  </label>

                  {newBannerPreview && (
                    <div className="w-16 h-10 bg-gray-100 border border-gray-300 dark:border-gray-700 overflow-hidden relative shrink-0">
                      <img src={newBannerPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setNewBannerFile(null);
                          setNewBannerPreview(null);
                        }}
                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 cursor-pointer"
                        title="Batal pilih"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={uploadBannerMutation.isPending || !newBannerFile || !newBannerTitle.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-1.5 px-2.5 rounded-none font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Save size={13} />
                  <span>{uploadBannerMutation.isPending ? 'Mengunggah Banner...' : 'Unggah & Pasang Banner'}</span>
                </button>
              </form>
            </div>

            {/* Zona Lokasi & Tarif (Compact Single Card) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Zona Lokasi & Tarif Layanan
              </h3>
              
              <div className="space-y-1">
                <select
                  value={detailCategory}
                  onChange={(e) => setDetailCategory(e.target.value)}
                  className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-xs text-gray-900 dark:text-white text-xs font-bold p-1.5 focus:ring-1 focus:ring-green-500"
                >
                  {CANTEEN_ZONES.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.label} (Ongkir {rp(z.deliveryFee)} + Layanan {rp(z.adminFee)} = {rp(z.deliveryFee + z.adminFee)})
                    </option>
                  ))}
                </select>

                <div className="bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-none border border-green-200 dark:border-green-900/50 text-[11px] font-semibold flex items-center justify-between flex-wrap gap-1">
                  <span className="text-green-800 dark:text-green-300">
                    🛵 Ongkir {rp(getZone(detailCategory).deliveryFee)} | 🛡️ Layanan {rp(getZone(detailCategory).adminFee)}
                  </span>
                  <span className="text-green-700 dark:text-green-400 font-black font-mono">
                    Total {rp(getZone(detailCategory).deliveryFee + getZone(detailCategory).adminFee)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    updateCategoryMutation.mutate({
                      id: selectedCanteen.id,
                      category: detailCategory
                    });
                  }}
                  disabled={updateCategoryMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 active:scale-98 text-white py-1 px-2.5 rounded-none font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Save size={13} />
                  <span>{updateCategoryMutation.isPending ? 'Menyimpan...' : 'Simpan Zona & Tarif'}</span>
                </button>
              </div>
            </div>

            {/* Jam Operasional (Compact) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Jam Operasional Toko
              </h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  updateHoursMutation.mutate({
                    id: selectedCanteen.id,
                    open_time: detailOpenTime,
                    close_time: detailCloseTime
                  });
                }}
                className="space-y-1.5"
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-1 border border-gray-200 dark:border-gray-700">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-0.5">Jam Buka</label>
                    <input
                      type="time"
                      lang="id-ID"
                      value={detailOpenTime}
                      onChange={(e) => setDetailOpenTime(e.target.value)}
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-xs text-gray-900 dark:text-white font-bold p-1 text-center text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-1 border border-gray-200 dark:border-gray-700">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-0.5">Jam Tutup</label>
                    <input
                      type="time"
                      lang="id-ID"
                      value={detailCloseTime}
                      onChange={(e) => setDetailCloseTime(e.target.value)}
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-xs text-gray-900 dark:text-white font-bold p-1 text-center text-xs font-mono"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={updateHoursMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 active:scale-98 text-white py-1 px-2.5 rounded-none font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Save size={13} />
                  <span>{updateHoursMutation.isPending ? 'Menyimpan...' : 'Simpan Jam Operasional'}</span>
                </button>
              </form>
            </div>

            {/* Pencairan Saldo (Withdrawal - Compact) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Pencairan Saldo Toko (Withdrawal)
              </h3>
              
              <div className="bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-none border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Saldo Toko:</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-xs">
                  Rp {parseFloat(selectedCanteen.balance || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Proses pencairan dana sebesar Rp ${parseFloat(withdrawalAmount).toLocaleString('id-ID')}?`)) {
                    withdrawMutation.mutate({
                      id: selectedCanteen.id,
                      amount: parseFloat(withdrawalAmount),
                      notes: withdrawalNotes
                    });
                  }
                }}
                className="space-y-1.5 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-0.5">Nominal (Rp)</label>
                    <input
                      type="number"
                      min="1000"
                      max={selectedCanteen.balance || 0}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 font-mono text-xs"
                      placeholder="Contoh: 50000"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-0.5">Keterangan Transfer</label>
                    <input
                      type="text"
                      value={withdrawalNotes}
                      onChange={(e) => setWithdrawalNotes(e.target.value)}
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-xs"
                      placeholder="Transfer BSI / Tunai..."
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending || !withdrawalAmount || withdrawalAmount > (selectedCanteen.balance || 0)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-1 px-2.5 rounded-none font-bold text-xs transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {withdrawMutation.isPending ? 'Memproses...' : 'Cairkan Saldo'}
                </button>
              </form>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}
