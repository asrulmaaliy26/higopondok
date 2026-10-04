import React, { useState } from 'react';
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
  Square
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getStorageUrl } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import { useCanteenStore } from '../../store/canteenStore';

export default function PromoVoucher() {
  const queryClient = useQueryClient();
  const { activeCanteenId } = useCanteenStore();
  const [activeTab, setActiveTab] = useState('vouchers'); // 'vouchers' | 'banners'

  // Banner State
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerData, setBannerData] = useState({ title: '' });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  // Voucher State
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [santriSearch, setSantriSearch] = useState('');
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

  // 1. Fetch Canteen Profile for Banner Info
  const { data: canteen, isLoading: isLoadingCanteen } = useQuery({
    queryKey: ['my_canteen', activeCanteenId],
    queryFn: async () => {
      const res = await api.get(`/my-canteen?canteen_id=${activeCanteenId}`);
      return res.data.data || res.data;
    },
    enabled: !!activeCanteenId
  });

  // 2. Fetch Canteen Vouchers
  const { data: vouchers = [], isLoading: isLoadingVouchers } = useQuery({
    queryKey: ['canteen_vouchers', activeCanteenId],
    queryFn: async () => {
      const res = await api.get(`/canteen/vouchers?canteen_id=${activeCanteenId}`);
      return res.data || [];
    },
    enabled: !!activeCanteenId
  });

  // 3. Fetch Santri Options for targeting
  const { data: santriOptions = [] } = useQuery({
    queryKey: ['canteen_santri_options', activeCanteenId],
    queryFn: async () => {
      const res = await api.get(`/vouchers/santri-options?canteen_id=${activeCanteenId}`);
      return res.data || [];
    },
    enabled: !!activeCanteenId
  });

  // Mutations for Banners
  const uploadBannerMutation = useMutation({
    mutationFn: (formData) => api.post(`/canteen/banners?canteen_id=${activeCanteenId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['my_canteen']);
      toast.success('Banner berhasil ditambahkan.');
      closeBannerModal();
    },
    onError: () => toast.error('Gagal mengunggah banner')
  });

  const toggleBannerStatusMutation = useMutation({
    mutationFn: (id) => api.put(`/canteen/banners/${id}/status?canteen_id=${activeCanteenId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['my_canteen']);
      toast.success('Status banner diperbarui');
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: (id) => api.delete(`/canteen/banners/${id}?canteen_id=${activeCanteenId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['my_canteen']);
      toast.success('Banner dihapus');
    }
  });

  // Mutations for Vouchers
  const createVoucherMutation = useMutation({
    mutationFn: (payload) => api.post(`/canteen/vouchers?canteen_id=${activeCanteenId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['canteen_vouchers']);
      toast.success('Voucher toko berhasil diterbitkan!');
      closeVoucherModal();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Gagal membuat voucher';
      toast.error(msg);
    }
  });

  const toggleVoucherMutation = useMutation({
    mutationFn: (id) => api.put(`/canteen/vouchers/${id}/toggle?canteen_id=${activeCanteenId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['canteen_vouchers']);
      toast.success('Status voucher diperbarui');
    }
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: (id) => api.delete(`/canteen/vouchers/${id}?canteen_id=${activeCanteenId}`),
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

  const filteredSantri = santriOptions.filter(s => {
    const q = santriSearch.toLowerCase();
    return (
      (s.santri_name && s.santri_name.toLowerCase().includes(q)) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.santri_room && s.santri_room.toLowerCase().includes(q)) ||
      (s.santri_class && s.santri_class.toLowerCase().includes(q))
    );
  });

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

  if (isLoadingCanteen) {
    return (
      <div className="p-8 text-center">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-gray-500">Memuat data toko...</p>
      </div>
    );
  }

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
            Banner Promo ({canteen?.banners?.length || 0})
          </button>
        </div>
      </div>

      {/* TAB 1: VOUCHERS MANAGEMENT */}
      {activeTab === 'vouchers' && (
        <div className="space-y-2">
          {/* Action Row */}
          <div className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 shadow-xs">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Daftar Kupon Khusus Toko Anda
            </span>
            <button
              onClick={() => setShowVoucherModal(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Voucher Toko</span>
            </button>
          </div>

          {/* List of Vouchers */}
          {isLoadingVouchers ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Memuat kupon toko...</p>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Voucher Toko</p>
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
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Banner Promosi di Layar Beranda
            </span>
            <button
              onClick={() => setShowBannerModal(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Unggah Banner</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {canteen?.banners && canteen.banners.length > 0 ? (
              canteen.banners.map((banner) => (
                <div key={banner.id} className={`relative aspect-[21/9] border ${banner.status === 'active' ? 'border-green-600' : 'border-gray-300 dark:border-gray-700 opacity-70'} overflow-hidden shadow-xs bg-gray-100 dark:bg-gray-800`}>
                  <img src={getStorageUrl(banner.image_path)} alt={banner.title} className="w-full h-full object-cover" />
                  
                  <div className="absolute top-2 left-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 max-w-[60%] truncate">
                    {banner.title}
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
                  Buat Voucher Toko ({canteen?.name})
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
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari santri penerima kupon..."
                        value={santriSearch}
                        onChange={(e) => setSantriSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      {filteredSantri.map((s) => {
                        const isChecked = voucherData.target_user_ids.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => handleSelectSantri(s.id)}
                            className={`p-2 flex items-center justify-between cursor-pointer hover:bg-green-50/50 ${isChecked ? 'bg-green-50 dark:bg-green-950/40' : ''}`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-gray-900 dark:text-white leading-tight truncate">
                                {s.santri_name || s.name}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                Kamar: {s.santri_room || '-'} • Kelas: {s.santri_class || '-'} • Wali: {s.name}
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
                      })}
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
