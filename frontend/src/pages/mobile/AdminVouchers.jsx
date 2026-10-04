import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Ticket, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Calendar, 
  Users, 
  Store, 
  Coins, 
  ShieldCheck, 
  ChevronLeft,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { toast } from 'react-hot-toast';
import { useNavigate } from '@tanstack/react-router';

export default function AdminVouchers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [santriSearch, setSantriSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    discount_type: 'admin_fee',
    discount_amount: '',
    min_purchase: 0,
    canteen_id: '',
    target_type: 'all',
    target_user_ids: [],
    quota: '',
    valid_until: ''
  });

  // 1. Fetch All Vouchers
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['admin_vouchers'],
    queryFn: async () => {
      const res = await api.get('/admin/vouchers');
      return res.data || [];
    }
  });

  // 2. Fetch Canteens for dropdown
  const { data: canteens = [] } = useQuery({
    queryKey: ['canteens'],
    queryFn: async () => {
      const res = await api.get('/canteens');
      return res.data.data || res.data || [];
    }
  });

  // 3. Fetch Santri / Wali Options for targeting
  const { data: santriOptions = [] } = useQuery({
    queryKey: ['santri_options'],
    queryFn: async () => {
      const res = await api.get('/admin/vouchers/santri-options');
      return res.data || [];
    }
  });

  // Mutation Create Voucher
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/vouchers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_vouchers']);
      toast.success('Voucher berhasil diterbitkan!');
      closeModal();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Gagal membuat voucher';
      toast.error(msg);
    }
  });

  // Mutation Toggle Status
  const toggleMutation = useMutation({
    mutationFn: (id) => api.put(`/admin/vouchers/${id}/status`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_vouchers']);
      toast.success('Status voucher diperbarui');
    },
    onError: () => toast.error('Gagal memperbarui status')
  });

  // Mutation Delete
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/vouchers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_vouchers']);
      toast.success('Voucher berhasil dihapus');
    },
    onError: () => toast.error('Gagal menghapus voucher')
  });

  const closeModal = () => {
    setShowCreateModal(false);
    setFormData({
      code: '',
      title: '',
      description: '',
      discount_type: 'admin_fee',
      discount_amount: '',
      min_purchase: 0,
      canteen_id: '',
      target_type: 'all',
      target_user_ids: [],
      quota: '',
      valid_until: ''
    });
    setSantriSearch('');
  };

  const handleSelectSantri = (userId) => {
    setFormData(prev => {
      const exists = prev.target_user_ids.includes(userId);
      return {
        ...prev,
        target_user_ids: exists 
          ? prev.target_user_ids.filter(id => id !== userId)
          : [...prev.target_user_ids, userId]
      };
    });
  };

  const handleSelectAllFilteredSantri = (filteredIds) => {
    setFormData(prev => {
      const allSelected = filteredIds.every(id => prev.target_user_ids.includes(id));
      if (allSelected) {
        return {
          ...prev,
          target_user_ids: prev.target_user_ids.filter(id => !filteredIds.includes(id))
        };
      } else {
        const merged = Array.from(new Set([...prev.target_user_ids, ...filteredIds]));
        return { ...prev, target_user_ids: merged };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code || !formData.title || !formData.discount_amount || !formData.valid_until) {
      toast.error('Mohon lengkapi seluruh kolom bertanda bintang');
      return;
    }
    if (formData.target_type === 'specific' && formData.target_user_ids.length === 0) {
      toast.error('Pilih minimal 1 santri penerima jika memilih target spesifik');
      return;
    }

    createMutation.mutate({
      ...formData,
      code: formData.code.toUpperCase().replace(/\s+/g, ''),
      discount_amount: parseFloat(formData.discount_amount),
      min_purchase: parseFloat(formData.min_purchase) || 0,
      quota: formData.quota ? parseInt(formData.quota) : null,
      canteen_id: formData.canteen_id || null
    });
  };

  // Filtered vouchers
  const filteredVouchers = vouchers.filter(v => 
    v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered santri options for modal
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
    return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-1.5 py-0.5 text-[10px] uppercase border border-amber-300 dark:border-amber-700">Diskon Jajan {formatted}</span>;
  };

  return (
    <div className="space-y-2 pb-16 font-sans">
      {/* HEADER COMPACT */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: '/dashboard' })}
              className="w-8 h-8 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-green-600" />
                Manajemen Voucher
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Penerbitan voucher diskon biaya admin, ongkir & produk untuk wali santri
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Voucher</span>
            <span className="sm:hidden">Baru</span>
          </button>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kode atau judul voucher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
            />
          </div>
        </div>
      </div>

      {/* LIST OF VOUCHERS */}
      {isLoading ? (
        <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Memuat data voucher...</p>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum ada voucher diterbitkan</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Klik tombol "Buat Voucher" untuk memberikan potongan ke wali santri.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filteredVouchers.map((v) => {
            const isExpired = new Date(v.valid_until) < new Date();
            return (
              <div 
                key={v.id}
                className={`bg-white dark:bg-gray-900 border ${v.is_active && !isExpired ? 'border-gray-200 dark:border-gray-800' : 'border-red-200 dark:border-red-900/50 opacity-80'} p-3 shadow-xs relative transition-all`}
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-mono font-black text-xs px-2 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider">
                        {v.code}
                      </span>
                      {getDiscountBadge(v.discount_type, v.discount_amount)}
                      {isExpired ? (
                        <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] font-bold px-1.5 py-0.5 border border-red-300 dark:border-red-800">
                          KADALUARSA
                        </span>
                      ) : !v.is_active ? (
                        <span className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px] font-bold px-1.5 py-0.5 border border-gray-300 dark:border-gray-700">
                          NONAKTIF
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-[10px] font-bold px-1.5 py-0.5 border border-green-300 dark:border-green-800">
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
                      onClick={() => toggleMutation.mutate(v.id)}
                      disabled={toggleMutation.isPending}
                      title={v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
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
                          deleteMutation.mutate(v.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Voucher Meta Specs */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Lingkup Toko:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {v.canteen ? v.canteen.name : '🌐 Semua Toko Pondok'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Target Penerima:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {v.target_type === 'all' 
                        ? '👥 Semua Wali Santri' 
                        : `🎯 ${v.target_user_ids?.length || 0} Santri Spesifik`}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Klaim & Kuota:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">
                      {v.claimed_count} {v.quota ? `/ ${v.quota} klaim` : 'klaim (Tanpa Batas)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Berlaku Hingga:</span>
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

      {/* MODAL BUAT VOUCHER (COMPACT & FLAT SHARP) */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-lg my-auto shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-green-600" />
                <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Terbitkan Voucher Baru
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-3 overflow-y-auto space-y-2.5 flex-1 text-xs">
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Kode Kupon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MISAL: BEBASADMIN"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Tipe Diskon <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-semibold text-gray-900 dark:text-white outline-none focus:border-green-600"
                  >
                    <option value="admin_fee">Potong Biaya Admin (HiPay)</option>
                    <option value="delivery_fee">Potong Ongkos Kirim</option>
                    <option value="product_discount">Diskon Total Belanja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Judul Voucher <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bebas Biaya Layanan Spesial Wali Santri"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Keterangan / Deskripsi Singkat
                </label>
                <input
                  type="text"
                  placeholder="Klaim sebelum habis untuk potongan biaya checkout"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Nominal Potongan (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="2000"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
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
                    placeholder="0"
                    value={formData.min_purchase}
                    onChange={(e) => setFormData({ ...formData, min_purchase: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Kuota Klaim (Kosong = Bebas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Misal: 50"
                    value={formData.quota}
                    onChange={(e) => setFormData({ ...formData, quota: e.target.value })}
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
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-600 text-[11px]"
                  />
                </div>
              </div>

              {/* Toko / Canteen Scope */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Berlaku Di Toko
                </label>
                <select
                  value={formData.canteen_id}
                  onChange={(e) => setFormData({ ...formData, canteen_id: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-semibold text-gray-900 dark:text-white outline-none focus:border-green-600"
                >
                  <option value="">🌐 Semua Toko & Kantin</option>
                  {canteens.map(c => (
                    <option key={c.id} value={c.id}>Kantin: {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Target Santri Filter */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Target Penerima Santri / Wali
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, target_type: 'all', target_user_ids: [] })}
                    className={`flex-1 py-1.5 font-bold text-xs border text-center transition-colors ${
                      formData.target_type === 'all'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    Semua Santri ({santriOptions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, target_type: 'specific' })}
                    className={`flex-1 py-1.5 font-bold text-xs border text-center transition-colors ${
                      formData.target_type === 'specific'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    Pilih Santri Tertentu ({formData.target_user_ids.length})
                  </button>
                </div>

                {/* Sub-form list of santri if specific */}
                {formData.target_type === 'specific' && (
                  <div className="border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-950/60 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Cari nama santri, kamar, kelas..."
                          value={santriSearch}
                          onChange={(e) => setSantriSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectAllFilteredSantri(filteredSantri.map(s => s.id))}
                        className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-[10px] font-bold shrink-0"
                      >
                        Pilih Semua Filter
                      </button>
                    </div>

                    {/* Santri checklist */}
                    <div className="max-h-36 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      {filteredSantri.length === 0 ? (
                        <p className="p-3 text-[11px] text-gray-400 text-center">Santri tidak ditemukan</p>
                      ) : (
                        filteredSantri.map((s) => {
                          const isChecked = formData.target_user_ids.includes(s.id);
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleSelectSantri(s.id)}
                              className={`p-2 flex items-center justify-between cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/20 ${isChecked ? 'bg-green-50 dark:bg-green-950/40' : ''}`}
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
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 shrink-0">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menerbitkan Voucher...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Terbitkan Voucher Sekarang
                    </>
                  )}
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
