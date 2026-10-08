import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, Plus, Edit2, Trash2, Filter, Shield, User, 
  Coffee, Bus, LogIn, X, AlertTriangle, Phone, GraduationCap, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw,
  Home, BookOpen, Layers, Store
} from 'lucide-react';
import { ROLES, getRoleLabel } from '../../config/roles';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingUserId, setEditingUserId] = useState(null);
  
  // SP (Surat Peringatan) states
  const [isSPModalOpen, setIsSPModalOpen] = useState(false);
  const [spFormData, setSpFormData] = useState({ id: null, penalty_points: 0 });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    santri_name: '',
    santri_room: '',
    santri_class: '',
    santri_level: '',
    password: '',
    role: 'user',
    status: 'active',
    canteen_ids: []
  });

  const impersonate = useAuthStore(state => state.impersonate);
  const currentUser = useAuthStore(state => state.user);
  const originalAdmin = useAuthStore(state => state.originalAdmin);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Super Admin (baik login langsung maupun saat memegang sesi impersonasi) berhak penuh atas Manajemen User
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN || originalAdmin?.role === ROLES.SUPER_ADMIN;

  // Proteksi: Manajemen User HANYA untuk Super Admin
  useEffect(() => {
    if (currentUser && !isSuperAdmin) {
      toast.error('Akses ditolak. Manajemen User hanya dapat diakses oleh Super Administrator.');
      navigate({ to: '/dashboard' });
    }
  }, [currentUser, isSuperAdmin, navigate]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1); // reset to page 1 on search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset to page 1 on filter change
  const handleRoleChange = (newRole) => {
    setFilterRole(newRole);
    setPage(1);
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(Number(newPerPage));
    setPage(1);
  };

  // Fetch paginated users from backend
  const { data: paginationData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin_users', page, perPage, debouncedSearch, filterRole],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('per_page', perPage);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterRole !== 'all') params.append('role', filterRole);
      
      const res = await api.get(`/admin/users?${params.toString()}`);
      return res.data;
    },
    placeholderData: (previousData) => previousData
  });

  // Extract pagination info
  const users = Array.isArray(paginationData?.data) ? paginationData.data : (Array.isArray(paginationData) ? paginationData : []);
  const totalUsers = paginationData?.total ?? users.length;
  const currentPage = paginationData?.current_page ?? page;
  const lastPage = paginationData?.last_page ?? Math.max(1, Math.ceil(totalUsers / perPage));
  const fromItem = paginationData?.from ?? (users.length > 0 ? (currentPage - 1) * perPage + 1 : 0);
  const toItem = paginationData?.to ?? (users.length > 0 ? fromItem + users.length - 1 : 0);

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: (data) => api.post('/admin/users', data),
    onSuccess: () => {
      toast.success('User berhasil ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menambahkan user');
    }
  });

  // Update User Mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/users/${id}`, data),
    onSuccess: () => {
      toast.success('User berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui user');
    }
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus user');
    }
  });

  // Impersonate Mutation
  const impersonateMutation = useMutation({
    mutationFn: (userId) => api.post(`/admin/impersonate/${userId}`),
    onSuccess: (res) => {
      const { user: targetUser, token } = res.data;
      impersonate(targetUser, token);
      queryClient.clear();
      toast.success(`Berhasil login sebagai ${targetUser.name}`);
      navigate({ to: '/dashboard', replace: true });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal beralih akun.');
    }
  });

  const canImpersonateUser = (targetUser) => {
    if (!targetUser) return false;
    // Tidak bisa menyamar ke akun sendiri
    if (targetUser.id === currentUser?.id) return false;
    // Tidak bisa menyamar sebagai Super Admin
    if (targetUser.role === ROLES.SUPER_ADMIN) return false;
    // Super Admin berhak login ke semua role lainnya (Admin, Kantin, Kurir, User)
    if (isSuperAdmin) return true;
    // Admin biasa hanya bisa login ke Kantin, Kurir, atau Santri/Wali (tidak boleh ke sesama Admin)
    if (currentUser?.role === ROLES.ADMIN) {
      return targetUser.role !== ROLES.ADMIN;
    }
    return false;
  };

  const handleImpersonate = (user) => {
    if (!canImpersonateUser(user)) {
      toast.error('Tidak memiliki izin untuk login sebagai akun ini.');
      return;
    }
    impersonateMutation.mutate(user.id);
  };

  const handleDelete = (user) => {
    if (user.id === currentUser?.id) {
      toast.error('Tidak bisa menghapus akun sendiri');
      return;
    }
    if (window.confirm(`Yakin ingin menghapus user ${user.name}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  // Fetch Canteens for Kurir assignment
  const { data: canteensData } = useQuery({
    queryKey: ['admin_available_canteens'],
    queryFn: async () => {
      const res = await api.get('/canteens');
      return res.data?.data || res.data || [];
    },
    staleTime: 5 * 60 * 1000
  });
  const canteens = Array.isArray(canteensData) ? canteensData : [];
  const [canteenSearchTerm, setCanteenSearchTerm] = useState('');

  const filteredCanteens = React.useMemo(() => {
    if (!canteenSearchTerm.trim()) return canteens;
    const q = canteenSearchTerm.toLowerCase().trim();
    return canteens.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.category?.toLowerCase().includes(q)
    );
  }, [canteens, canteenSearchTerm]);

  const openAddModal = () => {
    setModalMode('add');
    setCanteenSearchTerm('');
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      santri_name: '', 
      santri_room: '', 
      santri_class: '', 
      santri_level: '', 
      password: '', 
      role: 'user', 
      status: 'active',
      canteen_ids: []
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setEditingUserId(user.id);
    setCanteenSearchTerm('');
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      santri_name: user.santri_name || '',
      santri_room: user.santri_room || '',
      santri_class: user.santri_class || '',
      santri_level: user.santri_level || '',
      password: '', // Leave blank, only fill if changing
      role: user.role || 'user',
      status: user.status || 'active',
      canteen_ids: user.canteen_ids || (user.assigned_canteens ? user.assigned_canteens.map(c => c.id) : [])
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setCanteenSearchTerm('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'add') {
      createUserMutation.mutate(formData);
    } else {
      updateUserMutation.mutate({ id: editingUserId, data: formData });
    }
  };

  const getRoleBadge = (role) => {
    switch(role) {
      case ROLES.SUPER_ADMIN:
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9.5px] font-bold border border-amber-300 dark:border-amber-700 whitespace-nowrap"><Shield className="w-2.5 h-2.5"/>Super Admin</span>;
      case ROLES.ADMIN: 
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 text-[9.5px] font-bold border border-green-200 dark:border-green-800 whitespace-nowrap"><Shield className="w-2.5 h-2.5"/>Admin</span>;
      case ROLES.USER: 
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[9.5px] font-bold border border-blue-200 dark:border-blue-800 whitespace-nowrap"><User className="w-2.5 h-2.5"/>Santri/Wali</span>;
      case ROLES.KANTIN: 
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-[9.5px] font-bold border border-purple-200 dark:border-purple-800 whitespace-nowrap"><Coffee className="w-2.5 h-2.5"/>Pemilik Toko</span>;
      case ROLES.KURIR: 
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[9.5px] font-bold border border-gray-200 dark:border-gray-700 whitespace-nowrap"><Bus className="w-2.5 h-2.5"/>Kurir</span>;
      default: 
        return <span className="px-1.5 py-0.2 rounded-none bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 text-[9.5px] font-semibold border border-gray-200 dark:border-gray-700 whitespace-nowrap">{role}</span>;
    }
  };

  // Generate pagination page numbers
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    for (let i = Math.max(1, currentPage - delta); i <= Math.min(lastPage, currentPage + delta); i++) {
      pages.push(i);
    }
    return pages;
  };

  if (currentUser && !isSuperAdmin) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-none p-8 text-center border border-gray-200 dark:border-gray-800 shadow-xs my-6 max-w-md mx-auto">
        <Shield className="mx-auto h-10 w-10 text-amber-500 mb-2" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Akses Ditolak</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Halaman Manajemen User hanya dapat diakses oleh Super Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 sm:space-y-2 pb-20 max-w-7xl mx-auto px-1 sm:px-2 font-sans">
      {/* Header Compact */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button 
            onClick={() => navigate({ to: '/dashboard' })} 
            className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors shrink-0 cursor-pointer"
            title="Kembali ke Dashboard"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span>Manajemen User & Akun</span>
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              Santri/wali, admin, pemilik toko & kurir
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden sm:inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold font-mono border border-gray-200 dark:border-gray-700 rounded-none">
            Total: {totalUsers}
          </span>
          <button 
            onClick={openAddModal}
            className="inline-flex items-center justify-center px-2.5 py-1 bg-green-600 hover:bg-green-700 active:scale-98 text-white text-xs font-bold rounded-none transition-all gap-1 cursor-pointer h-[29px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah User</span>
          </button>
        </div>
      </div>

      {/* Action Bar & Compact Filters */}
      <div className="bg-white dark:bg-gray-900 p-1.5 sm:p-2 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama, santri, kamar, email, no hp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-7 pr-6 py-1 border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 text-xs font-medium h-[29px]"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Filters & Per Page Inline */}
        <div className="flex items-center gap-1 justify-end flex-wrap">
          {/* Role Filter */}
          <div className="relative flex-1 sm:flex-initial min-w-[120px]">
            <select
              value={filterRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="px-2 py-1 w-full border border-gray-200 dark:border-gray-700 rounded-none text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer h-[29px]"
            >
              <option value="all">Semua Peran</option>
              <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
              <option value={ROLES.ADMIN}>Admin</option>
              <option value={ROLES.USER}>Santri / Wali</option>
              <option value={ROLES.KANTIN}>Pemilik Toko</option>
              <option value={ROLES.KURIR}>Kurir</option>
            </select>
          </div>

          {/* Per Page Selector */}
          <div className="relative shrink-0">
            <select
              value={perPage}
              onChange={(e) => handlePerPageChange(e.target.value)}
              className="px-1.5 py-1 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer h-[29px]"
              title="Jumlah data per halaman"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="w-[29px] h-[29px] flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-green-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pagination Summary Info */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 px-1 font-medium">
        <span>
          Menampilkan <strong className="text-gray-800 dark:text-gray-200">{fromItem}</strong>-<strong className="text-gray-800 dark:text-gray-200">{toItem}</strong> dari total <strong className="text-gray-800 dark:text-gray-200">{totalUsers}</strong>
          {debouncedSearch && ` ("${debouncedSearch}")`}
        </span>
        <span>Hal {currentPage} / {lastPage}</span>
      </div>

      {/* Users List */}
      <div>
        {isLoading ? (
          <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
            <LoadingSpinner 
              text="Memuat data pengguna..." 
              subtext="Menghubungkan ke database akun pondok" 
              minHeight="min-h-[180px]"
            />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-none p-6 text-center border border-gray-200 dark:border-gray-800 shadow-xs">
            <User className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-1.5" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">Tidak ada pengguna ditemukan</h3>
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
              Coba ubah kata kunci pencarian atau ganti filter peran.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP VIEW: HIGH-DENSITY FLAT TABLE */}
            <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-800 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2">User / Email</th>
                    <th className="p-2">Peran</th>
                    <th className="p-2">Santri & Asrama</th>
                    <th className="p-2">WhatsApp</th>
                    <th className="p-2">Terdaftar</th>
                    <th className="p-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-[11px]">
                  {users.map((user, idx) => (
                    <tr key={user.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="p-2 text-center font-mono text-gray-400 font-bold text-[10px]">
                        {fromItem + idx}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 font-black text-[10px] flex items-center justify-center border border-green-200 dark:border-green-800 shrink-0">
                            {user.name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-gray-900 dark:text-white truncate block leading-tight">
                              {user.name} <span className="font-mono text-gray-400 font-normal text-[10px]">#{user.id}</span>
                            </span>
                            <span className="text-[10px] text-gray-400 block truncate">
                              {user.email || '-'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          {getRoleBadge(user.role)}
                          {user.role === ROLES.KURIR && (
                            <span className={`px-1 py-0.2 rounded-none text-[8.5px] font-bold border ${user.penalty_points > 0 ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20'}`}>
                              SP {user.penalty_points || 0}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {user.santri_name || user.santri_room ? (
                          <div>
                            <span className="font-semibold text-gray-800 dark:text-gray-200 block leading-tight">
                              {user.santri_name || '-'}
                            </span>
                            <span className="text-[10px] text-gray-400 block">
                              {user.santri_room && `Kamar: ${user.santri_room}`}
                              {user.santri_class && ` • Kls ${user.santri_class}`}
                              {user.santri_level && ` (${user.santri_level})`}
                            </span>
                          </div>
                        ) : user.role === ROLES.KURIR && user.assigned_canteens?.length > 0 ? (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium truncate max-w-[180px]">
                            🏪 {user.assigned_canteens.map(c => c.name).join(', ')}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {user.phone ? (
                          <a
                            href={`https://wa.me/${user.phone.replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-600 dark:text-green-400 hover:underline font-mono text-[10.5px] font-semibold"
                          >
                            {user.phone}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canImpersonateUser(user) && (
                            <button
                              onClick={() => handleImpersonate(user)}
                              disabled={impersonateMutation.isPending}
                              className="px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-none text-[9.5px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                              title="Login Sebagai Pengguna Ini"
                            >
                              <LogIn className="w-2.5 h-2.5" />
                              <span>Login As</span>
                            </button>
                          )}
                          {user.role === ROLES.KURIR && (
                            <button 
                              onClick={() => {
                                setSpFormData({ id: user.id, penalty_points: user.penalty_points || 0 });
                                setIsSPModalOpen(true);
                              }}
                              className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-none transition-colors cursor-pointer" 
                              title="Kelola SP Kurir"
                            >
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                          )}
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-none transition-colors cursor-pointer" 
                            title="Edit Data User"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDelete(user)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-none transition-colors cursor-pointer" 
                            title="Hapus User"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE VIEW: HIGH-DENSITY FLAT CARDS */}
            <div className="md:hidden space-y-1.5">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="bg-white dark:bg-gray-900 rounded-none p-2 border border-gray-200 dark:border-gray-800 shadow-xs hover:border-green-500 transition-colors space-y-1"
                >
                  {/* Top Bar: Name, ID, Role & Action Icons */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-none bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 font-black text-[9px] flex items-center justify-center border border-green-200 dark:border-green-800 shrink-0">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">
                        {user.name}
                      </span>
                      <span className="font-mono text-[9px] text-gray-400 shrink-0">#{user.id}</span>
                      {getRoleBadge(user.role)}
                    </div>

                    {/* Actions Compact */}
                    <div className="flex items-center gap-1 shrink-0">
                      {canImpersonateUser(user) && (
                        <button 
                          onClick={() => handleImpersonate(user)}
                          disabled={impersonateMutation.isPending}
                          className="px-1.5 py-0.2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-none text-[9px] font-bold cursor-pointer"
                          title="Login As"
                        >
                          Login
                        </button>
                      )}
                      {user.role === ROLES.KURIR && (
                        <button 
                          onClick={() => {
                            setSpFormData({ id: user.id, penalty_points: user.penalty_points || 0 });
                            setIsSPModalOpen(true);
                          }}
                          className="p-1 text-amber-600 border border-amber-200 dark:border-amber-800 rounded-none cursor-pointer" 
                          title="Kelola SP"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-1 text-blue-600 border border-blue-200 dark:border-blue-800 rounded-none cursor-pointer" 
                        title="Edit"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(user)}
                        className="p-1 text-red-600 border border-red-200 dark:border-red-800 rounded-none cursor-pointer" 
                        title="Hapus"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Info Row: Santri, Room, Phone in 1 Dense Box */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-1 px-1.5 rounded-none border border-gray-100 dark:border-gray-800 text-[10px] flex items-center justify-between gap-1 flex-wrap">
                    <div className="truncate min-w-0">
                      {user.santri_name ? (
                        <span>🎓 <strong className="text-gray-800 dark:text-gray-200">{user.santri_name}</strong> {user.santri_room ? `(${user.santri_room})` : ''}</span>
                      ) : user.role === ROLES.KURIR && user.assigned_canteens?.length > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">🏪 {user.assigned_canteens.map(c => c.name).join(', ')}</span>
                      ) : (
                        <span className="text-gray-400">{user.email || '-'}</span>
                      )}
                    </div>
                    {user.phone && (
                      <a 
                        href={`https://wa.me/${user.phone.replace(/^0/, '62')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-green-600 dark:text-green-400 hover:underline font-mono font-semibold shrink-0"
                      >
                        📱 {user.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* PAGINATION CONTROLS BAR */}
      {lastPage > 1 && (
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-gray-500 font-medium">
            Halaman <strong>{currentPage}</strong> dari <strong>{lastPage}</strong>
          </div>

          <div className="flex items-center gap-1 flex-wrap justify-center">
            {/* First Page */}
            <button
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Prev Page */}
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-100 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>

            {/* Page Number Buttons */}
            {getPageNumbers().map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-7 h-7 rounded-none text-xs font-bold transition-all cursor-pointer ${
                  pageNum === currentPage
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

            {/* Next Page */}
            <button
              onClick={() => setPage(prev => Math.min(lastPage, prev + 1))}
              disabled={currentPage >= lastPage}
              className="px-2.5 py-1 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-100 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setPage(lastPage)}
              disabled={currentPage >= lastPage}
              className="p-1.5 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal CRUD User (Add & Edit) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className={`bg-white dark:bg-gray-900 rounded-none w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto border border-gray-200 dark:border-gray-800 max-h-[92vh] flex flex-col transition-all duration-300 ${
            formData.role === 'kurir' ? 'max-w-2xl sm:max-w-3xl' : 'max-w-lg sm:max-w-xl'
          }`}>
            <div className="p-3 sm:p-3.5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-1.5">
                {modalMode === 'add' ? 'Tambah User Baru' : 'Edit Data User'}
              </h3>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-none bg-gray-200/60 dark:bg-gray-700 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-3 sm:p-3.5 space-y-2.5 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Nama Akun / Wali *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none font-medium"
                  placeholder="Contoh: Budi Santoso (Wali)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none font-medium"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">No. WhatsApp / HP</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none font-medium"
                    placeholder="08123456789"
                  />
                </div>
              </div>

              {/* Data Santri (Optional / For Santri Users) */}
              <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-none border border-gray-200 dark:border-gray-700 space-y-2">
                <span className="text-[10px] font-extrabold text-green-700 dark:text-green-400 uppercase tracking-wider block">
                  Data Santri (Opsional untuk Akun Wali/Santri)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Nama Santri</label>
                    <input 
                      type="text" 
                      value={formData.santri_name}
                      onChange={(e) => setFormData({...formData, santri_name: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none text-xs font-medium"
                      placeholder="Nama lengkap santri"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Kamar / Asrama</label>
                    <input 
                      type="text" 
                      value={formData.santri_room}
                      onChange={(e) => setFormData({...formData, santri_room: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none text-xs font-medium"
                      placeholder="Contoh: Al-Mannan B-04"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Kelas</label>
                    <input 
                      type="text" 
                      value={formData.santri_class}
                      onChange={(e) => setFormData({...formData, santri_class: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none text-xs font-medium"
                      placeholder="Contoh: 3 Aliyah"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Jenjang</label>
                    <input 
                      type="text" 
                      value={formData.santri_level}
                      onChange={(e) => setFormData({...formData, santri_level: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none text-xs font-medium"
                      placeholder="Contoh: SMA / MA"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Password {modalMode === 'edit' && '(Kosongkan jika tidak ingin mengubah)'}
                </label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required={modalMode === 'add'}
                  minLength={8}
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none font-medium"
                  placeholder={modalMode === 'edit' ? "Kosongkan jika tidak diubah" : "Minimal 8 karakter"}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Peran Akun (Role)</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 outline-none font-bold cursor-pointer"
                >
                  <option value="user">Santri / Wali</option>
                  <option value="kantin">Pemilik Toko (Kantin)</option>
                  <option value="kurir">Kurir</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {/* Toko Yang Dilayani Kurir (Khusus Role Kurir) */}
              {formData.role === 'kurir' && (
                <div className="p-2.5 bg-green-50/50 dark:bg-green-950/20 rounded-none border border-green-300/80 dark:border-green-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-green-200/80 dark:border-green-800/80 pb-2">
                    <div>
                      <span className="text-xs font-black text-green-900 dark:text-green-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Toko yang Dilayani Kurir *
                      </span>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Pilih toko tanggung jawab kurir ini. Kurir tanpa toko tidak akan menerima order.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto flex-wrap">
                      <span className="text-[10px] text-green-800 dark:text-green-300 font-extrabold bg-green-100 dark:bg-green-900/60 px-2 py-0.5 rounded-none border border-green-300 dark:border-green-700">
                        {formData.canteen_ids?.length || 0} / {canteens.length} Toko Dipilih
                      </span>
                    </div>
                  </div>

                  {/* Search Bar & Quick Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        value={canteenSearchTerm}
                        onChange={(e) => setCanteenSearchTerm(e.target.value)}
                        placeholder="Cari nama toko / kategori zona..."
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 font-medium transition-all"
                      />
                      {canteenSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setCanteenSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-none"
                          title="Hapus pencarian"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredCanteens.map(c => c.id);
                          const merged = Array.from(new Set([...(formData.canteen_ids || []), ...allFilteredIds]));
                          setFormData({ ...formData, canteen_ids: merged });
                        }}
                        disabled={filteredCanteens.length === 0}
                        className="px-2 py-1 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-none text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
                      >
                        Pilih Semua ({filteredCanteens.length})
                      </button>
                      {(formData.canteen_ids?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, canteen_ids: [] })}
                          className="px-2 py-1 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-none text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Batal Semua
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2-Column Wide Grid of Canteens */}
                  <div className="max-h-60 overflow-y-auto pr-1 pt-0.5">
                    {canteens.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-3 text-center">Belum ada data toko terdaftar.</p>
                    ) : filteredCanteens.length === 0 ? (
                      <div className="py-4 text-center text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-800/40 rounded-none border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-xs font-semibold">
                          Tidak ditemukan toko dengan kata kunci "{canteenSearchTerm}".
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredCanteens.map((c) => {
                          const isChecked = (formData.canteen_ids || []).includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-center gap-2 p-2 rounded-none border cursor-pointer transition-all select-none ${
                                isChecked
                                  ? 'bg-green-100/90 dark:bg-green-900/60 border-green-500 text-green-950 dark:text-green-100 font-bold'
                                  : 'bg-white dark:bg-gray-800/90 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = formData.canteen_ids || [];
                                  if (e.target.checked) {
                                    setFormData({ ...formData, canteen_ids: [...current, c.id] });
                                  } else {
                                    setFormData({ ...formData, canteen_ids: current.filter(id => id !== c.id) });
                                  }
                                }}
                                className="w-3.5 h-3.5 text-green-600 rounded-none border-gray-300 focus:ring-green-500 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs truncate block font-semibold">{c.name}</span>
                                  {c.category && (
                                    <span className="text-[9px] px-1 py-0.2 rounded-none bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0 font-bold uppercase">
                                      {c.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-none text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  className="flex-[2] py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-none text-xs transition-all flex justify-center items-center shadow-none active:scale-98 cursor-pointer"
                >
                  {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Simpan Data'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* SP (Penalty) Modal */}
      {isSPModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto border border-gray-200 dark:border-gray-800">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-amber-50 dark:bg-amber-900/20">
              <h3 className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Kelola SP Kurir
              </h3>
              <button onClick={() => setIsSPModalOpen(false)} className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-500 rounded-none hover:bg-amber-100 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-3.5 space-y-3">
              <div className="text-center">
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-1.5 font-medium">Tingkat Surat Peringatan (SP) Saat Ini</p>
                <div className="flex items-center justify-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => setSpFormData(prev => ({...prev, penalty_points: Math.max(0, prev.penalty_points - 1)}))}
                    className="w-8 h-8 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-lg font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-3xl font-black text-amber-600 w-12 text-center font-mono">{spFormData.penalty_points}</span>
                  <button 
                    type="button" 
                    onClick={() => setSpFormData(prev => ({...prev, penalty_points: Math.min(4, prev.penalty_points + 1)}))}
                    className="w-8 h-8 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-lg font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 mt-2.5 text-left space-y-0.5 bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-none border border-amber-200 dark:border-amber-800">
                  <strong className="text-amber-700 dark:text-amber-400">Ketentuan Sanksi Kurir:</strong><br/>
                  • SP 1: Teguran tertulis<br/>
                  • SP 2: Peringatan keras<br/>
                  • SP 3: Skorsing / pembatasan order<br/>
                  • SP 4: Pemutusan kemitraan
                </div>
              </div>

              <div className="pt-1 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsSPModalOpen(false)}
                  className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-none transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    updateUserMutation.mutate({ 
                      id: spFormData.id, 
                      data: { penalty_points: spFormData.penalty_points } 
                    });
                    setIsSPModalOpen(false);
                  }}
                  disabled={updateUserMutation.isPending}
                  className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-none transition-colors flex justify-center items-center shadow-none cursor-pointer"
                >
                  Simpan SP
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
