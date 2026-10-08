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
  Square,
  Phone
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { toast } from 'react-hot-toast';
import { useNavigate } from '@tanstack/react-router';
import santriData from '../../data/santri.json';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const uniqueJenjang = [...new Set(santriData.data.filter(r => r.length > 5 && r[4]).map(r => r[4]))].sort();

export default function AdminVouchers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVoucherForClaimers, setSelectedVoucherForClaimers] = useState(null);
  const [claimersSearch, setClaimersSearch] = useState('');
  const [claimersStatusFilter, setClaimersStatusFilter] = useState('all'); // 'all' | 'used' | 'unused'
  const [voucherStatusFilter, setVoucherStatusFilter] = useState('all'); // 'all' | 'active' | 'expired'
  const [searchQuery, setSearchQuery] = useState('');
  const [santriSearch, setSantriSearch] = useState('');
  const [filterJenjang, setFilterJenjang] = useState('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterKamar, setFilterKamar] = useState('all');

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

  // Fetch Claimers when a voucher is selected
  const { data: claimersData, isLoading: loadingClaimers } = useQuery({
    queryKey: ['admin_voucher_claimers', selectedVoucherForClaimers?.id],
    queryFn: async () => {
      const res = await api.get(`/admin/vouchers/${selectedVoucherForClaimers.id}/claimers`);
      return res.data || { voucher: null, claims: [] };
    },
    enabled: !!selectedVoucherForClaimers?.id
  });

  const rawClaims = claimersData?.claims || [];
  const usedCount = rawClaims.filter(c => c.is_used).length;
  const unusedCount = rawClaims.length - usedCount;

  const filteredClaims = rawClaims.filter((c) => {
    if (claimersStatusFilter === 'used' && !c.is_used) return false;
    if (claimersStatusFilter === 'unused' && c.is_used) return false;

    if (!claimersSearch.trim()) return true;
    const q = claimersSearch.toLowerCase();
    const u = c.user || {};
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.santri_name && u.santri_name.toLowerCase().includes(q)) ||
      (u.santri_room && u.santri_room.toLowerCase().includes(q)) ||
      (u.santri_class && String(u.santri_class).toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (c.order?.order_number && c.order.order_number.toLowerCase().includes(q))
    );
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
    setFilterJenjang('all');
    setFilterKelas('all');
    setFilterKamar('all');
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

  const handleSelectAllFilteredSantri = () => {
    const filteredIds = filteredSantri.map(s => s.id);
    setFormData(prev => ({
      ...prev,
      target_user_ids: Array.from(new Set([...prev.target_user_ids, ...filteredIds]))
    }));
  };

  const handleDeselectFilteredSantri = () => {
    const filteredIdSet = new Set(filteredSantri.map(s => s.id));
    setFormData(prev => ({
      ...prev,
      target_user_ids: prev.target_user_ids.filter(id => !filteredIdSet.has(id))
    }));
  };

  const handleClearAllSelectedSantri = () => {
    setFormData(prev => ({
      ...prev,
      target_user_ids: []
    }));
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
  const filteredVouchers = React.useMemo(() => {
    return vouchers.filter(v => {
      const isExpired = new Date(v.valid_until) < new Date();
      if (voucherStatusFilter === 'active' && (!v.is_active || isExpired)) return false;
      if (voucherStatusFilter === 'inactive' && v.is_active) return false;
      if (voucherStatusFilter === 'expired' && !isExpired) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        v.code.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.canteen?.name && v.canteen.name.toLowerCase().includes(q))
      );
    });
  }, [vouchers, voucherStatusFilter, searchQuery]);

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
      return (
        <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-1.5 py-0.2 text-[9.5px] border border-emerald-300 dark:border-emerald-800 rounded-none whitespace-nowrap">
          Adm {formatted}
        </span>
      );
    }
    if (type === 'delivery_fee') {
      return (
        <span className="bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold px-1.5 py-0.2 text-[9.5px] border border-blue-300 dark:border-blue-800 rounded-none whitespace-nowrap">
          Ongkir {formatted}
        </span>
      );
    }
    return (
      <span className="bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-1.5 py-0.2 text-[9.5px] border border-amber-300 dark:border-amber-800 rounded-none whitespace-nowrap">
        Jajan {formatted}
      </span>
    );
  };

  return (
    <div className="space-y-2 pb-16 font-sans max-w-7xl mx-auto px-1 sm:px-2">
      {/* HEADER COMPACT & METRICS */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 sm:p-2.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate({ to: '/dashboard' })}
              className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 rounded-none cursor-pointer"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Ticket className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span>Manajemen Voucher</span>
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                Penerbitan voucher diskon admin, ongkir & produk santri
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0 rounded-none h-[29px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Voucher</span>
          </button>
        </div>

        {/* METRICS & QUICK FILTER BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800">
          {/* Quick Metrics */}
          <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono font-bold">
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              Total: {vouchers.length}
            </span>
            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Aktif: {vouchers.filter(v => v.is_active && new Date(v.valid_until) >= new Date()).length}
            </span>
            <span className="px-1.5 py-0.5 bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-300 dark:border-green-800">
              Klaim: {vouchers.reduce((acc, v) => acc + (v.claimed_count || 0), 0)}
            </span>
          </div>

          {/* Search Input & Status Filter */}
          <div className="flex items-center gap-1 flex-1 sm:max-w-md">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari kode atau judul voucher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500 h-[27px] rounded-none font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setVoucherStatusFilter('all')}
                className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded-none border h-[27px] transition-colors cursor-pointer ${
                  voucherStatusFilter === 'all'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setVoucherStatusFilter('active')}
                className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded-none border h-[27px] transition-colors cursor-pointer ${
                  voucherStatusFilter === 'active'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }`}
              >
                Aktif
              </button>
              <button
                type="button"
                onClick={() => setVoucherStatusFilter('expired')}
                className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded-none border h-[27px] transition-colors cursor-pointer ${
                  voucherStatusFilter === 'expired'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }`}
              >
                Kadaluarsa
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LIST OF VOUCHERS (HIGH-DENSITY FLAT TICKET CARDS) */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <LoadingSpinner 
            text="Memuat data voucher..." 
            subtext="Menghubungkan ke basis data kupon pondok" 
            minHeight="min-h-[200px]"
          />
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum ada voucher yang cocok</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {searchQuery || voucherStatusFilter !== 'all' 
              ? 'Coba ganti filter atau kata kunci pencarian.' 
              : 'Klik tombol "Buat Voucher" untuk memberikan promo ke santri/wali.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {filteredVouchers.map((v) => {
            const isExpired = new Date(v.valid_until) < new Date();
            const isActive = v.is_active && !isExpired;
            return (
              <div 
                key={v.id}
                className={`bg-white dark:bg-gray-900 border ${
                  isActive 
                    ? 'border-gray-200 dark:border-gray-800 border-l-[3px] border-l-emerald-600' 
                    : isExpired 
                      ? 'border-red-200 dark:border-red-900/60 border-l-[3px] border-l-red-500 opacity-85' 
                      : 'border-gray-300 dark:border-gray-700 border-l-[3px] border-l-gray-400 opacity-80'
                } p-2 shadow-xs relative transition-all rounded-none flex flex-col justify-between`}
              >
                {/* Header Card: Code, Discount, Status, Actions */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1 min-w-0 flex-wrap">
                      <span className="font-mono font-black text-[11px] px-1.5 py-0.2 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider rounded-none shrink-0">
                        {v.code}
                      </span>
                      {getDiscountBadge(v.discount_type, v.discount_amount)}
                      {isExpired ? (
                        <span className="bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 text-[9px] font-bold px-1 py-0.2 border border-red-300 dark:border-red-800 rounded-none shrink-0">
                          KADALUARSA
                        </span>
                      ) : !v.is_active ? (
                        <span className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[9px] font-bold px-1 py-0.2 border border-gray-300 dark:border-gray-700 rounded-none shrink-0">
                          NONAKTIF
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[9px] font-bold px-1 py-0.2 border border-emerald-300 dark:border-emerald-800 rounded-none shrink-0">
                          AKTIF
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate(v.id)}
                        disabled={toggleMutation.isPending}
                        title={v.is_active ? 'Nonaktifkan voucher' : 'Aktifkan voucher'}
                        className={`px-1.5 py-0.5 text-[9.5px] font-bold border transition-colors rounded-none h-[23px] cursor-pointer ${
                          v.is_active 
                            ? 'border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300' 
                            : 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                        }`}
                      >
                        {v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus voucher "${v.code}"?`)) {
                            deleteMutation.mutate(v.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        title="Hapus voucher"
                        className="w-[23px] h-[23px] flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 transition-colors rounded-none cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="mb-1.5">
                    <h3 className="text-xs font-black text-gray-900 dark:text-white leading-tight truncate">
                      {v.title}
                    </h3>
                    {v.description && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 leading-tight">
                        {v.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Compact Grid Meta Info */}
                <div className="grid grid-cols-2 gap-1 bg-gray-50 dark:bg-gray-800/40 p-1.5 border border-gray-100 dark:border-gray-800 text-[10px]">
                  <div className="truncate">
                    <span className="text-gray-400 mr-1">Toko:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {v.canteen ? v.canteen.name : '🌐 Semua'}
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-gray-400 mr-1">Target:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {v.target_type === 'all' 
                        ? '👥 Semua Wali' 
                        : `🎯 ${v.target_user_ids?.length || 0} Santri`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 col-span-2 sm:col-span-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-700/60">
                    <div className="truncate">
                      <span className="text-gray-400 mr-1">Klaim:</span>
                      <span className="font-bold font-mono text-gray-900 dark:text-gray-100">
                        {v.claimed_count}{v.quota ? ` / ${v.quota}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVoucherForClaimers(v);
                        setClaimersSearch('');
                        setClaimersStatusFilter('all');
                      }}
                      className="px-1.5 py-0.5 text-[9px] font-bold bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/60 dark:text-green-300 border border-green-300 dark:border-green-800 rounded-none cursor-pointer flex items-center gap-1 transition-colors shrink-0"
                      title="Lihat siapa saja yang sudah klaim voucher ini"
                    >
                      <Users size={9} className="shrink-0" />
                      <span>Pengklaim ({v.claimed_count})</span>
                    </button>
                  </div>
                  <div className="truncate pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-700/60 flex items-center gap-1">
                    <span className="text-gray-400">Berlaku:</span>
                    <span className={`font-semibold font-mono ${isExpired ? 'text-red-500 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                      {new Date(v.valid_until).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                        Hasil: <strong className="text-gray-900 dark:text-white font-mono">{filteredSantri.length}</strong> • Terpilih: <strong className="text-green-600 dark:text-green-400 font-mono">{formData.target_user_ids.length}</strong>
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
                        {formData.target_user_ids.length > 0 && (
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
                          const isChecked = formData.target_user_ids.includes(s.id);
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

      {/* MODAL DAFTAR PENGKLAIM VOUCHER (HIGH-DENSITY & FLAT SHARP) */}
      {selectedVoucherForClaimers && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-2xl my-auto shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-2.5 sm:p-3 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between shrink-0 bg-gray-50 dark:bg-gray-950 gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-xs px-2 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider rounded-none">
                    {selectedVoucherForClaimers.code}
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider truncate">
                    Daftar Pengklaim Voucher
                  </h3>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium truncate mt-0.5">
                  {selectedVoucherForClaimers.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedVoucherForClaimers(null);
                  setClaimersSearch('');
                  setClaimersStatusFilter('all');
                }}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 rounded-none cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-2 sm:p-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-gray-400 uppercase">Rekap:</span>
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-bold border border-gray-200 dark:border-gray-700 font-mono">
                    Total: {rawClaims.length}
                  </span>
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800 font-mono">
                    Terpakai: {usedCount}
                  </span>
                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800 font-mono">
                    Belum Dipakai: {unusedCount}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={claimersSearch}
                    onChange={(e) => setClaimersSearch(e.target.value)}
                    placeholder="Cari santri, wali, kamar..."
                    className="w-full pl-7 pr-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none focus:ring-1 focus:ring-green-500 h-[29px] font-medium"
                  />
                  {claimersSearch && (
                    <button
                      type="button"
                      onClick={() => setClaimersSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setClaimersStatusFilter('all')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-none border transition-colors h-[29px] cursor-pointer ${
                      claimersStatusFilter === 'all'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Semua ({rawClaims.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimersStatusFilter('unused')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-none border transition-colors h-[29px] cursor-pointer ${
                      claimersStatusFilter === 'unused'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Belum ({unusedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimersStatusFilter('used')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-none border transition-colors h-[29px] cursor-pointer ${
                      claimersStatusFilter === 'used'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Terpakai ({usedCount})
                  </button>
                </div>
              </div>
            </div>

            {/* List Table / Content */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-2.5">
              {loadingClaimers ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-gray-400 font-medium">Memuat daftar pengklaim voucher...</p>
                </div>
              ) : filteredClaims.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-gray-200 dark:border-gray-800 p-4">
                  <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    {rawClaims.length === 0 ? 'Belum Ada yang Mengklaim' : 'Tidak Ditemukan'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {rawClaims.length === 0 
                      ? 'Belum ada santri atau wali yang mengklaim voucher ini.' 
                      : 'Tidak ada data pengklaim yang cocok dengan filter / pencarian.'}
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-800 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2">Santri / Kamar</th>
                        <th className="p-2">Wali Santri / Kontak</th>
                        <th className="p-2">Waktu Klaim</th>
                        <th className="p-2 text-right">Status Voucher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-[11px]">
                      {filteredClaims.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="p-2 text-center font-mono text-gray-400 font-bold text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="p-2">
                            <span className="font-bold text-gray-900 dark:text-white block leading-tight">
                              {item.user?.santri_name || item.user?.name || 'Santri'}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5">
                              Kamar: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.user?.santri_room || '-'}</span>
                              {item.user?.santri_class && ` • Kls ${item.user.santri_class}`}
                              {item.user?.santri_level && ` (${item.user.santri_level})`}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className="font-medium text-gray-800 dark:text-gray-200 block leading-tight">
                              {item.user?.name || '-'}
                            </span>
                            {item.user?.phone ? (
                              <a
                                href={`https://wa.me/${item.user.phone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mt-0.5 font-mono"
                              >
                                <Phone size={9} />
                                <span>{item.user.phone}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-gray-400 block mt-0.5">-</span>
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap font-mono text-[10px] text-gray-600 dark:text-gray-300">
                            {new Date(item.claimed_at).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {item.is_used ? (
                              <div>
                                <span className="inline-block px-1.5 py-0.5 text-[9.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-none">
                                  ✓ Sudah Digunakan
                                </span>
                                {item.order && (
                                  <span className="block text-[9.5px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                                    Pesanan #{item.order.order_number}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 text-[9.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none">
                                ● Belum Digunakan
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2 sm:p-2.5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950 text-xs shrink-0">
              <span className="text-[10px] text-gray-500 font-medium">
                Menampilkan {filteredClaims.length} dari {rawClaims.length} klaim
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedVoucherForClaimers(null);
                  setClaimersSearch('');
                  setClaimersStatusFilter('all');
                }}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-none cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
