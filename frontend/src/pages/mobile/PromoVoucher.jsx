import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Ticket, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Upload, 
  Search, 
  Users, 
  Clock,
  CheckSquare,
  Square,
  Filter,
  RotateCcw,
  Store
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getStorageUrl } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import { useCanteenStore } from '../../store/canteenStore';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../config/roles';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import santriData from '../../data/santri.json';

const uniqueJenjang = [...new Set(santriData.data.filter(r => r.length > 5 && r[4]).map(r => r[4]))].sort();

export default function PromoVoucher() {
  const queryClient = useQueryClient();
  const { activeCanteenId, setActiveCanteenId } = useCanteenStore();
  const currentUser = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPER_ADMIN || originalAdmin?.role === ROLES.SUPER_ADMIN;

  const [activeTab, setActiveTab] = useState('vouchers'); // 'vouchers' | 'banners'

  // Banner State
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerData, setBannerData] = useState({ title: '' });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerCanteenId, setBannerCanteenId] = useState('');

  // Voucher State
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherCanteenId, setVoucherCanteenId] = useState('');
  const [santriSearch, setSantriSearch] = useState('');
  const [filterJenjang, setFilterJenjang] = useState('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterKamar, setFilterKamar] = useState('all');
  const [voucherData, setVoucherData] = useState({
    code: '',
    title: '',
    description: '',
    discount_type: 'product_discount', // for canteen, usually product_discount or delivery_fee
    discount_amount: '',
    min_purchase: 0,
    target_type: 'all',
    target_user_ids: [],
    quota: '',
    valid_until: ''
  });

  // 0. Fetch list canteens (Untuk memastikan activeCanteenId tersedia baik bagi Kantin maupun Admin)
  const { data: rawCanteens, isLoading: isLoadingCanteens } = useQuery({
    queryKey: ['canteens_for_promo', isAdmin],
    queryFn: async () => {
      const endpoint = isAdmin ? '/admin/canteens' : '/my-canteens';
      const res = await api.get(endpoint);
      return res.data?.data || res.data || [];
    }
  });

  const canteensList = Array.isArray(rawCanteens) ? rawCanteens : (Array.isArray(rawCanteens?.data) ? rawCanteens.data : []);

  // Default selection: Bagi Admin default ke 'all' agar seluruh voucher tampil langsung
  const selectedCanteenId = activeCanteenId !== undefined && activeCanteenId !== null
    ? activeCanteenId
    : (isAdmin ? 'all' : (canteensList.length > 0 ? canteensList[0].id : 'all'));

  useEffect(() => {
    if ((activeCanteenId === undefined || activeCanteenId === null) && isAdmin) {
      setActiveCanteenId('all');
    }
  }, [activeCanteenId, isAdmin, setActiveCanteenId]);

  // 1. Fetch Canteen Profile for Banner Info (Hanya jika toko spesifik dipilih)
  const { data: canteen, isLoading: isLoadingCanteen, isFetching: isFetchingCanteen } = useQuery({
    queryKey: ['my_canteen', selectedCanteenId],
    queryFn: async () => {
      const res = await api.get(`/my-canteen?canteen_id=${selectedCanteenId}`);
      return res.data.data || res.data;
    },
    enabled: !!selectedCanteenId && selectedCanteenId !== 'all'
  });

  // 1b. Fetch All Public Active Banners (Jika mode 'all' dipilih)
  const { data: allBanners = [], isLoading: isLoadingAllBanners } = useQuery({
    queryKey: ['all_active_banners'],
    queryFn: async () => {
      const res = await api.get('/banners');
      return res.data || [];
    },
    enabled: selectedCanteenId === 'all'
  });

  // 2. Fetch Canteen Vouchers (Mendukung mode 'all' maupun toko spesifik)
  const { data: vouchers = [], isLoading: isLoadingVouchers, isFetching: isFetchingVouchers } = useQuery({
    queryKey: ['canteen_vouchers', selectedCanteenId],
    queryFn: async () => {
      const param = selectedCanteenId ? `?canteen_id=${selectedCanteenId}` : '';
      const res = await api.get(`/canteen/vouchers${param}`);
      return res.data || [];
    },
  });

  // 3. Fetch Santri Options for targeting
  const { data: santriOptions = [], isLoading: isLoadingSantriOptions } = useQuery({
    queryKey: ['canteen_santri_options', selectedCanteenId],
    queryFn: async () => {
      const param = selectedCanteenId && selectedCanteenId !== 'all' ? `?canteen_id=${selectedCanteenId}` : '';
      const res = await api.get(`/vouchers/santri-options${param}`);
      return res.data || [];
    },
  });

  // Mutations for Banners
  const uploadBannerMutation = useMutation({
    mutationFn: (formData) => {
      const targetCId = bannerCanteenId || (selectedCanteenId !== 'all' ? selectedCanteenId : (canteensList[0]?.id));
      return api.post(`/canteen/banners?canteen_id=${targetCId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my_canteen']);
      queryClient.invalidateQueries(['all_active_banners']);
      toast.success('Banner berhasil ditambahkan.');
      closeBannerModal();
    },
    onError: () => toast.error('Gagal mengunggah banner')
  });

  const toggleBannerStatusMutation = useMutation({
    mutationFn: (id) => {
      const targetCId = selectedCanteenId !== 'all' ? selectedCanteenId : '';
      const query = targetCId ? `?canteen_id=${targetCId}` : '';
      return api.put(`/canteen/banners/${id}/status${query}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my_canteen']);
      queryClient.invalidateQueries(['all_active_banners']);
      toast.success('Status banner diperbarui');
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: (id) => {
      const targetCId = selectedCanteenId !== 'all' ? selectedCanteenId : '';
      const query = targetCId ? `?canteen_id=${targetCId}` : '';
      return api.delete(`/canteen/banners/${id}${query}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my_canteen']);
      queryClient.invalidateQueries(['all_active_banners']);
      toast.success('Banner dihapus');
    }
  });

  // Mutations for Vouchers
  const createVoucherMutation = useMutation({
    mutationFn: (payload) => {
      const targetCId = payload.canteen_id !== undefined ? payload.canteen_id : (selectedCanteenId !== 'all' ? selectedCanteenId : null);
      const query = targetCId ? `?canteen_id=${targetCId}` : '';
      return api.post(`/canteen/vouchers${query}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['canteen_vouchers']);
      toast.success('Voucher berhasil diterbitkan!');
      closeVoucherModal();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Gagal membuat voucher';
      toast.error(msg);
    }
  });

  const toggleVoucherMutation = useMutation({
    mutationFn: (id) => {
      const query = selectedCanteenId && selectedCanteenId !== 'all' ? `?canteen_id=${selectedCanteenId}` : '';
      return api.put(`/canteen/vouchers/${id}/status${query}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['canteen_vouchers']);
      toast.success('Status voucher diperbarui');
    }
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: (id) => {
      const query = selectedCanteenId && selectedCanteenId !== 'all' ? `?canteen_id=${selectedCanteenId}` : '';
      return api.delete(`/canteen/vouchers/${id}${query}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['canteen_vouchers']);
      toast.success('Voucher dihapus');
    }
  });

  // Handlers
  const handleUploadBanner = (e) => {
    e.preventDefault();
    if (!bannerFile) return toast.error('Gambar banner wajib diisi');
    const formData = new FormData();
    formData.append('title', bannerData.title);
    formData.append('image', bannerFile);
    uploadBannerMutation.mutate(formData);
  };

  const closeBannerModal = () => {
    setShowBannerModal(false);
    setBannerData({ title: '' });
    setBannerFile(null);
    setBannerPreview(null);
  };

  const closeVoucherModal = () => {
    setShowVoucherModal(false);
    setVoucherData({
      code: '',
      title: '',
      description: '',
      discount_type: 'product_discount',
      discount_amount: '',
      min_purchase: 0,
      target_type: 'all',
      target_user_ids: [],
      quota: '',
      valid_until: ''
    });
    setSantriSearch('');
    setFilterJenjang('all');
    setFilterKelas('all');
    setFilterKamar('all');
  };

  const handleSelectSantri = (userId) => {
    setVoucherData(prev => {
      const exists = prev.target_user_ids.includes(userId);
      return {
        ...prev,
        target_user_ids: exists 
          ? prev.target_user_ids.filter(id => id !== userId)
          : [...prev.target_user_ids, userId]
      };
    });
  };

  const handleSelectAllFilteredSantri = () => {
    const filteredIds = filteredSantri.map(s => s.id);
    setVoucherData(prev => ({
      ...prev,
      target_user_ids: Array.from(new Set([...prev.target_user_ids, ...filteredIds]))
    }));
  };

  const handleDeselectFilteredSantri = () => {
    const filteredIdSet = new Set(filteredSantri.map(s => s.id));
    setVoucherData(prev => ({
      ...prev,
      target_user_ids: prev.target_user_ids.filter(id => !filteredIdSet.has(id))
    }));
  };

  const handleClearAllSelectedSantri = () => {
    setVoucherData(prev => ({
      ...prev,
      target_user_ids: []
    }));
  };

  const handleCreateVoucherSubmit = (e) => {
    e.preventDefault();
    if (!voucherData.code || !voucherData.title || !voucherData.discount_amount || !voucherData.valid_until) {
      toast.error('Mohon lengkapi seluruh kolom wajib bertanda bintang');
      return;
    }
    if (voucherData.target_type === 'specific' && voucherData.target_user_ids.length === 0) {
      toast.error('Pilih minimal 1 santri penerima jika memilih target santri spesifik');
      return;
    }

    createVoucherMutation.mutate({
      ...voucherData,
      code: voucherData.code.toUpperCase().replace(/\s+/g, ''),
      discount_amount: parseFloat(voucherData.discount_amount),
      min_purchase: parseFloat(voucherData.min_purchase) || 0,
      quota: voucherData.quota ? parseInt(voucherData.quota) : null
    });
  };

  // Opsi unik Jenjang (MA, MI, PPTQ, SMP) sinkron persis dengan Profil User
  const jenjangOptions = uniqueJenjang;

  // Opsi unik Kelas sesuai Jenjang yang dipilih (mengacu pada master santri.json & data santri)
  const kelasOptions = React.useMemo(() => {
    let classes = [];
    if (filterJenjang === 'all') {
      classes = santriData.data.filter(r => r.length > 5 && r[5]).map(r => r[5]);
    } else {
      classes = santriData.data.filter(r => r.length > 5 && r[4] === filterJenjang && r[5]).map(r => r[5]);
    }
    santriOptions.forEach(s => {
      const sLevel = s.santri_level === 'Aliyah' ? 'MA' : s.santri_level;
      if ((filterJenjang === 'all' || sLevel === filterJenjang) && s.santri_class && s.santri_class !== '-' && s.santri_class.trim() !== '') {
        classes.push(s.santri_class.trim());
      }
    });
    return [...new Set(classes)].sort();
  }, [santriOptions, filterJenjang]);

  // Opsi unik Kamar / Asrama (Al Majid, Asmah, dll)
  const kamarOptions = React.useMemo(() => {
    const set = new Set();
    santriOptions.forEach(s => {
      if (s.santri_room && s.santri_room !== '-' && s.santri_room.trim() !== '') {
        set.add(s.santri_room.trim());
      }
    });
    return Array.from(set).sort();
  }, [santriOptions]);

  // Filter santri berdasarkan seluruh dimensi (Jenjang, Kelas, Kamar, Pencarian)
  const filteredSantri = React.useMemo(() => {
    return santriOptions.filter(s => {
      const sLevel = s.santri_level === 'Aliyah' ? 'MA' : s.santri_level;
      if (filterJenjang !== 'all' && sLevel !== filterJenjang) return false;
      if (filterKelas !== 'all' && s.santri_class !== filterKelas) return false;
      if (filterKamar !== 'all' && s.santri_room !== filterKamar) return false;
      if (santriSearch.trim()) {
        const q = santriSearch.toLowerCase().trim();
        const matchName = s.santri_name && s.santri_name.toLowerCase().includes(q);
        const matchWali = s.name && s.name.toLowerCase().includes(q);
        const matchRoom = s.santri_room && s.santri_room.toLowerCase().includes(q);
        const matchClass = s.santri_class && s.santri_class.toLowerCase().includes(q);
        const matchLevel = (sLevel && sLevel.toLowerCase().includes(q)) || (s.santri_level && s.santri_level.toLowerCase().includes(q));
        if (!matchName && !matchWali && !matchRoom && !matchClass && !matchLevel) return false;
      }
      return true;
    });
  }, [santriOptions, filterJenjang, filterKelas, filterKamar, santriSearch]);

  const getDiscountBadge = (type, amount) => {
    const formatted = `Rp ${parseFloat(amount || 0).toLocaleString('id-ID')}`;
    if (type === 'admin_fee') {
      return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-1.5 py-0.5 text-[10px] uppercase border border-emerald-300 dark:border-emerald-700">Potongan Admin {formatted}</span>;
    }
    if (type === 'delivery_fee') {
      return <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold px-1.5 py-0.5 text-[10px] uppercase border border-blue-300 dark:border-blue-700">Potongan Ongkir {formatted}</span>;
    }
    return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-1.5 py-0.5 text-[10px] uppercase border border-amber-300 dark:border-amber-700">Diskon Produk {formatted}</span>;
  };


  const displayBanners = selectedCanteenId === 'all' ? allBanners : (canteen?.banners || []);
  const isLoadingBanners = selectedCanteenId === 'all' ? isLoadingAllBanners : (isLoadingCanteen || isFetchingCanteen);

  return (
    <div className="space-y-2 pb-16 font-sans">
      {/* HEADER COMPACT (FLAT SHARP) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-green-600" />
              Promo & Voucher Toko
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Kelola voucher potongan belanja santri dan banner promosi kantin Anda
            </p>
          </div>
        </div>

        {/* SELECTOR TOKO JIKA MULTI-TOKO ATAU ADMIN */}
        {(isAdmin || canteensList.length > 0) && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 border border-emerald-300 dark:border-emerald-800 rounded-none mb-2 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 shrink-0">Filter Toko:</span>
            <select
              value={selectedCanteenId || 'all'}
              onChange={(e) => setActiveCanteenId(e.target.value)}
              className="w-full text-xs font-bold bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 py-1 px-2 rounded-none text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-green-500"
            >
              <option value="all">🌟 Semua Kantin & Promo Global (Seluruh Toko)</option>
              {canteensList.map((c) => (
                <option key={c.id} value={c.id}>
                  🏪 {c.name} {c.user?.name ? `(Kantin: ${c.user.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* TABS */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`py-1.5 text-xs font-black uppercase tracking-wider text-center border transition-colors ${
              activeTab === 'vouchers'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            Voucher Toko ({vouchers.length})
          </button>
          <button
            onClick={() => setActiveTab('banners')}
            className={`py-1.5 text-xs font-black uppercase tracking-wider text-center border transition-colors ${
              activeTab === 'banners'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            Banner Promo ({displayBanners.length})
          </button>
        </div>
      </div>

      {/* TAB 1: VOUCHERS MANAGEMENT */}
      {activeTab === 'vouchers' && (
        <div className="space-y-2">
          {/* Action Row */}
          <div className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 shadow-xs">
            <div>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                {selectedCanteenId === 'all' ? 'Seluruh Kupon di Semua Kantin & Pondok' : `Daftar Kupon Khusus ${canteen?.name || 'Toko'}`}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {vouchers.length} voucher aktif dan terdaftar
              </span>
            </div>
            <button
              onClick={() => {
                setVoucherCanteenId(selectedCanteenId !== 'all' ? selectedCanteenId : '');
                setShowVoucherModal(true);
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Voucher</span>
            </button>
          </div>

          {/* List of Vouchers */}
          {(isLoadingVouchers || isFetchingVouchers || isLoadingCanteens) && vouchers.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <LoadingSpinner 
                text="Memuat kupon..." 
                subtext="Menghubungkan ke server data voucher" 
                minHeight="min-h-[180px]"
              />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Voucher</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Terbitkan voucher diskon untuk menarik minat santri dan wali jajan di toko Anda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {vouchers.map((v) => {
                const isExpired = new Date(v.valid_until) < new Date();
                return (
                  <div
                    key={v.id}
                    className={`bg-white dark:bg-gray-900 border ${v.is_active && !isExpired ? 'border-gray-200 dark:border-gray-800' : 'border-red-200 dark:border-red-900/50 opacity-80'} p-3 shadow-xs relative`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="font-mono font-black text-xs px-2 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider">
                            {v.code}
                          </span>
                          {v.canteen ? (
                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-1.5 py-0.5 text-[10px] uppercase border border-emerald-300 dark:border-emerald-700">
                              🏪 {v.canteen.name}
                            </span>
                          ) : (
                            <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-bold px-1.5 py-0.5 text-[10px] uppercase border border-purple-300 dark:border-purple-700">
                              🌐 Promo Pondok (Semua Toko)
                            </span>
                          )}
                          {getDiscountBadge(v.discount_type, v.discount_amount)}
                          {isExpired ? (
                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 border border-red-300">
                              KADALUARSA
                            </span>
                          ) : !v.is_active ? (
                            <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 border border-gray-300">
                              NONAKTIF
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 border border-green-300">
                              AKTIF
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate">
                          {v.title}
                        </h3>
                        {v.description && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                            {v.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleVoucherMutation.mutate(v.id)}
                          className={`px-2 py-1 text-[10px] font-bold border transition-colors ${
                            v.is_active 
                              ? 'border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300' 
                              : 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                          }`}
                        >
                          {v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Yakin ingin menghapus voucher "${v.code}"?`)) {
                              deleteVoucherMutation.mutate(v.id);
                            }
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Target Santri:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {v.target_type === 'all' ? '👥 Semua Santri' : `🎯 ${v.target_user_ids?.length || 0} Santri Pilihan`}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Klaim Terpakai:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">
                          {v.claimed_count} {v.quota ? `/ ${v.quota} kuota` : 'klaim'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block text-[10px]">Kedaluwarsa:</span>
                        <span className={`font-semibold font-mono ${isExpired ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          {new Date(v.valid_until).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BANNERS MANAGEMENT */}
      {activeTab === 'banners' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 shadow-xs">
            <div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                {selectedCanteenId === 'all' ? 'Seluruh Banner Promo Aktif' : `Banner Promosi ${canteen?.name || 'Toko'}`}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Tampil di beranda belanja santri
              </span>
            </div>
            <button
              onClick={() => {
                setBannerCanteenId(selectedCanteenId !== 'all' ? selectedCanteenId : (canteensList[0]?.id || ''));
                setShowBannerModal(true);
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Unggah Banner</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(isLoadingBanners || isLoadingCanteens) && displayBanners.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <LoadingSpinner 
                  text="Memuat banner..." 
                  subtext="Mengambil poster promosi aktif" 
                  minHeight="min-h-[160px]"
                />
              </div>
            ) : displayBanners.length > 0 ? (
              displayBanners.map((banner) => (
                <div key={banner.id} className={`relative aspect-[21/9] border ${banner.status === 'active' ? 'border-green-600' : 'border-gray-300 dark:border-gray-700 opacity-70'} overflow-hidden shadow-xs bg-gray-100 dark:bg-gray-800`}>
                  <img src={getStorageUrl(banner.image_path)} alt={banner.title} className="w-full h-full object-cover" />
                  
                  <div className="absolute top-2 left-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 max-w-[65%] truncate flex items-center gap-1">
                    <span>{banner.title}</span>
                    {banner.canteen?.name && (
                      <span className="text-emerald-400 font-normal">({banner.canteen.name})</span>
                    )}
                  </div>
                  
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <button 
                      onClick={() => toggleBannerStatusMutation.mutate(banner.id)}
                      disabled={toggleBannerStatusMutation.isPending}
                      className={`px-2 py-0.5 text-[10px] font-bold text-white transition-colors ${banner.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}`}
                    >
                      {banner.status === 'active' ? 'AKTIF' : 'NONAKTIF'}
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Yakin ingin menghapus banner ini?')) {
                          deleteBannerMutation.mutate(banner.id);
                        }
                      }}
                      disabled={deleteBannerMutation.isPending}
                      className="p-1 bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Banner</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Unggah gambar banner promosi untuk ditampilkan di beranda santri.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL BUAT VOUCHER TOKO */}
      {showVoucherModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-lg my-auto shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-green-600" />
                <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Buat Voucher {voucherCanteenId ? `Toko` : (selectedCanteenId !== 'all' ? `(${canteen?.name})` : `(Semua Kantin / Pondok)`)}
                </h3>
              </div>
              <button
                onClick={closeVoucherModal}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucherSubmit} className="p-3 overflow-y-auto space-y-2.5 flex-1 text-xs">
              {(isAdmin || selectedCanteenId === 'all') && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Toko Penerbit Kupon
                  </label>
                  <select
                    value={voucherCanteenId}
                    onChange={(e) => setVoucherCanteenId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-semibold text-gray-900 dark:text-white outline-none focus:border-green-600"
                  >
                    <option value="">🌐 Berlaku Semua Toko (Promo Pondok)</option>
                    {canteensList.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏪 Khusus Toko: {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Kode Kupon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MISAL: HEMAT5RB"
                    value={voucherData.code}
                    onChange={(e) => setVoucherData({ ...voucherData, code: e.target.value.toUpperCase() })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Tipe Diskon <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={voucherData.discount_type}
                    onChange={(e) => setVoucherData({ ...voucherData, discount_type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-semibold text-gray-900 dark:text-white outline-none focus:border-green-600"
                  >
                    <option value="product_discount">Diskon Total Belanja Toko</option>
                    <option value="delivery_fee">Subsidi Ongkos Kirim</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Judul Promo Kupon <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Diskon Rp 5.000 Menu Snack & Makan"
                  value={voucherData.title}
                  onChange={(e) => setVoucherData({ ...voucherData, title: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Keterangan Promo
                </label>
                <input
                  type="text"
                  placeholder="Berlaku untuk semua santri / wali santri pilihan"
                  value={voucherData.description}
                  onChange={(e) => setVoucherData({ ...voucherData, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Nominal Diskon (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="5000"
                    value={voucherData.discount_amount}
                    onChange={(e) => setVoucherData({ ...voucherData, discount_amount: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Min. Belanja (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="15000"
                    value={voucherData.min_purchase}
                    onChange={(e) => setVoucherData({ ...voucherData, min_purchase: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Kuota Klaim (Opsional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Bebas"
                    value={voucherData.quota}
                    onChange={(e) => setVoucherData({ ...voucherData, quota: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Berlaku Hingga <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={voucherData.valid_until}
                    onChange={(e) => setVoucherData({ ...voucherData, valid_until: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-600 text-[11px]"
                  />
                </div>
              </div>

              {/* Target Santri Filter */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Target Penerima Santri
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setVoucherData({ ...voucherData, target_type: 'all', target_user_ids: [] })}
                    className={`flex-1 py-1.5 font-bold text-xs border text-center transition-colors ${
                      voucherData.target_type === 'all'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    Semua Santri ({santriOptions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherData({ ...voucherData, target_type: 'specific' })}
                    className={`flex-1 py-1.5 font-bold text-xs border text-center transition-colors ${
                      voucherData.target_type === 'specific'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    Pilih Santri Tertentu ({voucherData.target_user_ids.length})
                  </button>
                </div>

                {voucherData.target_type === 'specific' && (
                  <div className="border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-950/60 space-y-2">
                    {/* DROPDOWN FILTER BAR: JENJANG, KELAS, KAMAR */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9.5px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                          Jenjang
                        </label>
                        <select
                          value={filterJenjang}
                          onChange={(e) => {
                            setFilterJenjang(e.target.value);
                            setFilterKelas('all');
                          }}
                          className="w-full px-1.5 py-1 text-[11px] font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none rounded-none focus:border-green-600"
                        >
                          <option value="all">Semua Jenjang</option>
                          {jenjangOptions.map((j) => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                          Kelas
                        </label>
                        <select
                          value={filterKelas}
                          onChange={(e) => setFilterKelas(e.target.value)}
                          className="w-full px-1.5 py-1 text-[11px] font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none rounded-none focus:border-green-600"
                        >
                          <option value="all">Semua Kelas</option>
                          {kelasOptions.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                          Kamar / Asrama
                        </label>
                        <select
                          value={filterKamar}
                          onChange={(e) => setFilterKamar(e.target.value)}
                          className="w-full px-1.5 py-1 text-[11px] font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none rounded-none focus:border-green-600"
                        >
                          <option value="all">Semua Kamar</option>
                          {kamarOptions.map((km) => (
                            <option key={km} value={km}>{km}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* SEARCH INPUT */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari nama santri, wali, kamar, kelas..."
                        value={santriSearch}
                        onChange={(e) => setSantriSearch(e.target.value)}
                        className="w-full pl-7 pr-7 py-1 text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none rounded-none focus:border-green-600"
                      />
                      {santriSearch && (
                        <button
                          type="button"
                          onClick={() => setSantriSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* STATUS & BATCH ACTIONS */}
                    <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5 text-[10px]">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        Hasil: <strong className="text-gray-900 dark:text-white font-mono">{filteredSantri.length}</strong> • Terpilih: <strong className="text-green-600 dark:text-green-400 font-mono">{voucherData.target_user_ids.length}</strong>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredSantri}
                          disabled={filteredSantri.length === 0}
                          className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-none transition-colors disabled:opacity-40 cursor-pointer"
                          title="Pilih semua santri yang ada di hasil filter saat ini"
                        >
                          + Pilih Semua ({filteredSantri.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectFilteredSantri}
                          disabled={filteredSantri.length === 0}
                          className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-none transition-colors disabled:opacity-40 cursor-pointer"
                          title="Batalkan pilihan santri di hasil filter saat ini"
                        >
                          - Batal Filter
                        </button>
                        {voucherData.target_user_ids.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllSelectedSantri}
                            className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 font-bold rounded-none transition-colors cursor-pointer"
                            title="Kosongkan seluruh santri yang telah dipilih"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SANTRI LIST SCROLLBOX */}
                    <div className="max-h-44 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      {filteredSantri.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 space-y-1">
                          <p className="text-[11px] font-bold">Tidak ada santri yang sesuai filter</p>
                          <p className="text-[10px]">Coba ubah filter jenjang, kelas, atau kata kunci pencarian.</p>
                        </div>
                      ) : (
                        filteredSantri.map((s) => {
                          const isChecked = voucherData.target_user_ids.includes(s.id);
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleSelectSantri(s.id)}
                              className={`p-2 flex items-center justify-between cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors ${isChecked ? 'bg-green-50/90 dark:bg-green-950/40' : ''}`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-xs text-gray-900 dark:text-white leading-tight">
                                    {s.santri_name || s.name}
                                  </p>
                                  {s.santri_level && s.santri_level !== '-' && (
                                    <span className="px-1 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-extrabold text-[9px] rounded-none">
                                      {s.santri_level === 'Aliyah' ? 'MA' : s.santri_level}
                                    </span>
                                  )}
                                  {s.santri_class && s.santri_class !== '-' && (
                                    <span className="px-1 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-bold text-[9px] rounded-none">
                                      Kls {s.santri_class}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                                  Kamar: <span className="font-medium text-gray-700 dark:text-gray-300">{s.santri_room || '-'}</span> • Wali: {s.name}
                                </p>
                              </div>
                              <div className="shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 shrink-0">
                <button
                  type="submit"
                  disabled={createVoucherMutation.isPending}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {createVoucherMutation.isPending ? 'Menerbitkan...' : 'Terbitkan Voucher Toko'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL BANNER */}
      {showBannerModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-auto">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
              <h3 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                Upload Promo / Banner Toko
              </h3>
              <button onClick={closeBannerModal} className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUploadBanner} className="p-3 space-y-3 text-xs">
              {(isAdmin || selectedCanteenId === 'all') && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Pilih Toko untuk Banner Ini <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bannerCanteenId}
                    onChange={(e) => setBannerCanteenId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-semibold text-gray-900 dark:text-white outline-none focus:border-green-600"
                  >
                    {canteensList.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏪 {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Judul Promo <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 outline-none focus:border-green-600 text-gray-900 dark:text-white"
                  placeholder="Contoh: Promo Sarapan Hemat"
                  value={bannerData.title}
                  onChange={e => setBannerData({...bannerData, title: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Gambar Banner <span className="text-red-500">*</span>
                </label>
                <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors overflow-hidden group">
                  <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error('Ukuran gambar banner maksimal 2 MB');
                          e.target.value = '';
                          return;
                        }
                        setBannerFile(file);
                        setBannerPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {bannerPreview ? (
                    <div className="aspect-[21/9] relative">
                      <img src={bannerPreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white font-medium flex items-center gap-1 text-xs"><Upload className="w-3.5 h-3.5" /> Ganti Gambar</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                      <Upload className="w-6 h-6 mb-1 text-gray-400" />
                      <p className="text-xs font-semibold">Klik atau drop gambar banner</p>
                      <p className="text-[10px] mt-0.5 text-gray-400">Format: JPG, PNG (Max 2MB) • Rasio 21:9</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={uploadBannerMutation.isPending}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {uploadBannerMutation.isPending ? 'Mengunggah...' : 'Kirim Banner Promosi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
