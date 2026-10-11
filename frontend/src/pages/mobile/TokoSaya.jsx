import React, { useState } from 'react';
import { Store, Save, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Star, Clock, CheckCircle2, ChevronDown, Search, User, Flame, Layers } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ProductFormModal } from '../../components/modals/ProductFormModal';
import { useCanteenStore } from '../../store/canteenStore';
import { useAuthStore } from '../../store/authStore';
import { useActiveOrdersCount } from '../../hooks/useActiveOrdersCount';
import { ROLES } from '../../config/roles';
import AppImage from '../../components/common/AppImage';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function TokoSaya() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const stopImpersonating = useAuthStore((state) => state.stopImpersonating);
  const { activeCanteenId, setActiveCanteenId, isStoreSelected, setIsStoreSelected } = useCanteenStore();
  const [page, setPage] = useState(1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const activeOrdersCount = useActiveOrdersCount();

  React.useEffect(() => {
    const handleScroll = (e) => {
      const scrollY = window.scrollY || e?.target?.scrollTop || document.querySelector('main')?.scrollTop || 0;
      setIsScrolled(scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Fetch all canteens owned by this user
  const { data: rawCanteensList } = useQuery({
    queryKey: ['my_canteens_list'],
    queryFn: async () => {
      const res = await api.get('/my-canteens');
      return res.data.data || res.data || [];
    }
  });

  const canteensList = Array.isArray(rawCanteensList)
    ? rawCanteensList
    : (Array.isArray(rawCanteensList?.data) ? rawCanteensList.data : []);

  const filteredCanteensList = React.useMemo(() => {
    if (!storeSearch.trim()) return canteensList;
    const q = storeSearch.toLowerCase();
    return canteensList.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.category?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.user?.name?.toLowerCase().includes(q) ||
      c.user?.email?.toLowerCase().includes(q)
    );
  }, [canteensList, storeSearch]);



  // Product Form State (handled mostly in modal now, keeping simple state for toggling)
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' (Semua Menu) | 'popular' (Paling Laris)
  const [showAllProducts, setShowAllProducts] = useState(false); // Toggle Open All Produk

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setPage(1);
  };

  const handleToggleShowAll = () => {
    setShowAllProducts(prev => !prev);
    setPage(1);
  };

  // Queries
  const { data: canteen, isLoading: isLoadingCanteen } = useQuery({
    queryKey: ['canteen', activeCanteenId],
    queryFn: async () => {
      try {
        const res = await api.get(`/my-canteen?canteen_id=${activeCanteenId}`);
        return res.data.data || res.data;
      } catch (error) {
        if (error.response?.status === 404) {
          setIsStoreSelected(false);
          setActiveCanteenId(null);
        }
        throw error;
      }
    },
    enabled: !!activeCanteenId,
    retry: (failureCount, error) => error.response?.status !== 404 && failureCount < 3
  });

  const { data: productsRes, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', page, activeCanteenId, activeTab, searchTerm, showAllProducts],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('canteen_id', activeCanteenId);
        if (showAllProducts) {
          params.append('all', '1');
        } else {
          params.append('page', page);
          params.append('per_page', '10');
        }
        if (activeTab === 'popular') {
          params.append('tab', 'popular');
        }
        if (searchTerm.trim()) {
          params.append('search', searchTerm.trim());
        }
        const res = await api.get(`/my-products?${params.toString()}`);
        return res.data;
      } catch (error) {
        if (error.response?.status === 404) {
          setIsStoreSelected(false);
          setActiveCanteenId(null);
        }
        throw error;
      }
    },
    keepPreviousData: true,
    enabled: !!activeCanteenId,
    retry: (failureCount, error) => error.response?.status !== 404 && failureCount < 3
  });

  const products = productsRes?.data || [];
  const pagination = (!showAllProducts && productsRes) ? (productsRes.meta ? {
    current_page: productsRes.meta.current_page,
    last_page: productsRes.meta.last_page,
    total: productsRes.meta.total,
  } : {
    current_page: productsRes.current_page,
    last_page: productsRes.last_page,
    total: productsRes.total,
  }) : null;

  // Mutations
  const openAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };


  const saveProductMutation = useMutation({
    mutationFn: (formDataPayload) => {
      if (editingProduct) {
        formDataPayload.append('_method', 'PUT');
        return api.post(`/my-products/${editingProduct.id}?canteen_id=${activeCanteenId}`, formDataPayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return api.post(`/my-products?canteen_id=${activeCanteenId}`, formDataPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['products', page] });
      const previousProductsRes = queryClient.getQueryData(['products', page]);
      return { previousProductsRes };
    },
    onError: (err, payload, context) => {
      if (context?.previousProductsRes) {
        queryClient.setQueryData(['products', page], context.previousProductsRes);
      }
      toast.error('Koneksi terputus. Gagal menyimpan produk.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onSuccess: () => {
      setShowProductModal(false);
      setEditingProduct(null);
      toast.success(editingProduct ? 'Produk berhasil diupdate!' : 'Produk berhasil ditambahkan!');
    }
  });

  const handleSaveProduct = async (data, file) => {
    const formData = new FormData();
    const priceVal = parseFloat(data.price || 0);
    const fallbackHpp = priceVal > 1000 ? priceVal - 1000 : priceVal;
    const finalHpp = data.hpp !== undefined && data.hpp !== '' ? parseFloat(data.hpp) : fallbackHpp;

    formData.append('name', data.name);
    formData.append('category', data.category || '');
    formData.append('description', data.description || '');
    if (data.variant_config) {
      formData.append('variant_config', typeof data.variant_config === 'string' ? data.variant_config : JSON.stringify(data.variant_config));
    }
    formData.append('price', priceVal);
    formData.append('hpj', priceVal);
    formData.append('hpp', finalHpp);
    formData.append('stock', parseInt(data.stock || 0, 10));
    formData.append('is_available', data.is_available ? 1 : 0);
    
    if (file) {
      formData.append('image', file);
    }
    formData.append('canteen_id', activeCanteenId);
    
    await saveProductMutation.mutateAsync(formData);
  };

  const deleteProductMutation = useMutation({
    mutationFn: (id) => api.delete(`/my-products/${id}?canteen_id=${activeCanteenId}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['products', page] });
      const previousProductsRes = queryClient.getQueryData(['products', page]);
      
      if (previousProductsRes?.data) {
        queryClient.setQueryData(['products', page], {
          ...previousProductsRes,
          data: previousProductsRes.data.filter(product => product.id !== id)
        });
      }
      
      return { previousProductsRes };
    },
    onError: (err, id, context) => {
      if (context?.previousProductsRes) {
        queryClient.setQueryData(['products', page], context.previousProductsRes);
      }
      toast.error('Koneksi terputus. Gagal menghapus produk.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onSuccess: () => {
      toast.success('Produk berhasil dihapus!');
    }
  });

  const handleDeleteProduct = (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    deleteProductMutation.mutate(id);
  };

  const handleBack = () => {
    if (originalAdmin) {
      stopImpersonating();
      queryClient.clear();
      window.location.href = '/dashboard';
      return;
    }
    if (canteensList.length > 1) {
      setIsStoreSelected(false);
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: '/dashboard' });
    }
  };

  if (isLoadingCanteen && !canteen) {
    return (
      <div className="bg-gray-50 min-h-screen dark:bg-gray-950 font-sans">
        <div className="bg-white dark:bg-gray-900 sticky top-0 z-20 shadow-xs px-2.5 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: '/dashboard' })} 
              className="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">Toko Saya</h1>
          </div>
        </div>
        <div className="p-4 max-w-7xl mx-auto space-y-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-none shadow-xs">
            <LoadingSpinner 
              text="Memuat Toko Saya..." 
              subtext="Menghubungkan ke data produk dan etalase toko" 
              minHeight="min-h-[160px]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!isStoreSelected) {
    return (
      <div className="bg-gray-50 min-h-screen pb-28 sm:pb-32 dark:bg-gray-950 font-sans">
        <div className="bg-white dark:bg-gray-900 sticky top-0 z-20 shadow-xs px-2.5 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: '/dashboard' })} 
              className="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">Pilih Toko</h1>
          </div>
          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-none border border-gray-200 dark:border-gray-700">
            {canteensList.length} Toko
          </span>
        </div>
        
        <div className="p-2 max-w-2xl mx-auto space-y-2 pb-24 sm:pb-28">
          {/* Mode Admin Banner */}
          {(currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPER_ADMIN) && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 border border-emerald-300 dark:border-emerald-800 rounded-none text-xs text-emerald-900 dark:text-emerald-200 font-bold flex items-center justify-between">
              <span>🛡️ Mode Administrator: Akses & Kelola Seluruh Toko Mitra</span>
              <span className="text-[10px] font-mono bg-white dark:bg-gray-800 px-1.5 py-0.5 border border-emerald-300 dark:border-emerald-700">Total {canteensList.length} Toko</span>
            </div>
          )}

          {/* Pencarian Toko untuk Akun Multi-Toko / Admin */}
          {canteensList.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari toko, nama pemilik, kategori..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-none text-xs focus:ring-1 focus:ring-green-500 outline-none font-medium"
              />
              {storeSearch && (
                <button
                  type="button"
                  onClick={() => setStoreSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {!canteensList || canteensList.length === 0 ? (
             <div className="text-center py-8 bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-700 shadow-xs mt-2">
               <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-none flex items-center justify-center mx-auto mb-2">
                 <Store className="w-6 h-6 text-gray-400" />
               </div>
               <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Belum Ada Toko</h3>
               <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 px-4">Anda belum memiliki toko. Silakan buat toko baru melalui halaman Profil Anda.</p>
               <button 
                 onClick={() => navigate({ to: '/dashboard/profile' })}
                 className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
               >
                 <Plus className="w-4 h-4" />
                 Buat Toko Baru
               </button>
             </div>
          ) : filteredCanteensList.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs text-xs text-gray-500">
              Tidak ditemukan toko dengan kata kunci "{storeSearch}".
            </div>
          ) : (
            filteredCanteensList.map(c => (
              <div 
                key={c.id} 
                onClick={() => { setActiveCanteenId(c.id); setIsStoreSelected(true); }}
                className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-green-600 rounded-none shadow-xs flex flex-col gap-1.5 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-none bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                      <AppImage 
                        src={c.image} 
                        alt={c.name} 
                        type="canteen" 
                        className="w-full h-full object-cover" 
                      />
                      {c.pending_orders_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[9px] font-black px-1 py-0.2 rounded-none animate-pulse">
                          {c.pending_orders_count}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white group-hover:text-green-600 transition-colors truncate">
                        {c.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 truncate leading-none mt-0.5">
                        {c.description || 'Toko Hidayah Go'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors shrink-0 ml-2" />
                </div>

                {/* Info Akun Kantin yang Menaungi Toko */}
                {c.user && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 rounded-none text-[10.5px]">
                    <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Akun Pengelola:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                      {c.user.name}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-mono text-[9.5px] truncate">
                      ({c.user.email})
                    </span>
                    {c.user.phone && (
                      <span className="text-gray-500 font-mono text-[9.5px] truncate hidden sm:inline">
                        • {c.user.phone}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-none ${c.is_open ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`font-semibold ${c.is_open ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {c.is_open ? 'Buka' : 'Tutup'} • {c.open_time?.substring(0,5) || '09:00'} - {c.close_time?.substring(0,5) || '17:00'}
                    </span>
                  </div>
                  {c.category && (
                    <span className="text-[9px] font-bold uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 py-0.2 border border-gray-200 dark:border-gray-700">
                      {c.category}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 h-full pb-20 dark:bg-gray-950 font-sans relative">
      {/* FLOATING & SOLID STICKY TOP NAVIGATION (TETAP DI ATAS SAAT SCROLL) */}
      <div
        className={`fixed left-0 right-0 z-40 transition-all duration-200 ${
          originalAdmin ? 'top-[36px] sm:top-[40px]' : 'top-0'
        } ${
          isScrolled
            ? 'bg-gradient-to-r from-emerald-950 via-green-900 to-teal-950 border-b border-green-700/80 shadow-md py-2 px-3 sm:px-4'
            : 'bg-transparent p-2 sm:p-3 pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              type="button"
              onClick={handleBack} 
              className="pointer-events-auto w-8 h-8 rounded-none bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur-xs transition-colors shadow-xs border border-white/20 cursor-pointer active:scale-95 shrink-0"
              title={canteensList.length > 1 ? "Ganti Toko / Kembali" : "Kembali"}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {isScrolled && (
              <div className="min-w-0 animate-fade-in">
                <h2 className="font-extrabold text-sm text-white tracking-tight leading-none drop-shadow-xs truncate">
                  {canteen?.name || 'Toko Saya'}
                </h2>
                <p className="text-[10px] text-emerald-200 font-medium mt-0.5 truncate">
                  {canteen?.category ? `Kategori: ${canteen.category.toUpperCase()}` : 'Outlet Merchant Partner'}
                </p>
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            {canteensList.length > 1 && (
              <button
                type="button"
                onClick={() => setIsStoreSelected(false)}
                className="px-2 py-0.5 bg-black/70 hover:bg-black text-white text-[10px] font-bold border border-white/20 backdrop-blur-xs transition-colors cursor-pointer"
                title="Pilih Toko Lain"
              >
                Ganti Toko
              </button>
            )}
            <div className="px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-extrabold uppercase tracking-wider border border-white/20 backdrop-blur-xs">
              Merchant Partner
            </div>
          </div>
        </div>
      </div>

      {/* HEADER BANNER */}
      <div className="relative h-36 sm:h-44 bg-gradient-to-r from-emerald-950 via-green-900 to-teal-950 overflow-hidden">
        {canteen?.image ? (
          <AppImage 
            src={canteen.image} 
            alt={canteen.name || "Banner Toko"} 
            type="canteen"
            className="w-full h-full object-cover opacity-85" 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/80 relative">
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-green-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="w-11 h-11 bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center mb-1">
              <Store className="w-6 h-6 text-emerald-300" />
            </div>
            <span className="text-[11px] font-bold tracking-wider text-emerald-200 uppercase">Outlet Merchant Partner</span>
          </div>
        )}
        
        {/* Subtle dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/60 pointer-events-none" />
      </div>

      {/* STORE INFO CARD (Overlapping banner) */}
      <div className="px-2 sm:px-4 max-w-7xl mx-auto -mt-8 relative z-10">
        <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs p-2.5 sm:p-3 border border-gray-200 dark:border-gray-800">
          {/* Quick Store Switcher for Admin & Multi-Store Owners */}
          {(canteensList.length > 1 || currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPER_ADMIN) && (
            <div className="mb-2.5 p-2 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-none shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Store className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-100 truncate">
                    Toko yang Dikelola:
                  </span>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-300 px-1.5 py-0.2 font-mono font-bold shrink-0">
                    #{canteen?.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStoreSelected(false)}
                  className="px-2 py-0.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-none text-[11px] font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap shadow-xs"
                  title="Lihat Daftar Toko Lengkap"
                >
                  Daftar Toko
                </button>
              </div>

              <div className="w-full min-w-0">
                <select
                  value={activeCanteenId || ''}
                  onChange={(e) => {
                    const newId = Number(e.target.value);
                    setActiveCanteenId(newId);
                    setIsStoreSelected(true);
                  }}
                  className="w-full min-w-0 px-2 py-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-none text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer truncate"
                >
                  {canteensList.map(c => (
                    <option key={c.id} value={c.id}>
                      #{c.id} {c.name} {c.category ? `(${c.category})` : ''} — {c.is_open ? '🟢 Buka' : '🔴 Tutup'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-1.5">
            <div className="flex-1">
              <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                {canteen?.name || 'Toko Saya'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 pr-2">
                {canteen?.description || 'Belum ada deskripsi.'}
              </p>

              {canteen?.user && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                  <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Akun Pengelola:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{canteen.user.name}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[10px]">({canteen.user.email})</span>
                  {canteen.user.phone && <span className="text-gray-400 font-mono text-[10px] hidden sm:inline">• {canteen.user.phone}</span>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-none border ${canteen?.is_open ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'}`}>
                  {canteen?.is_open ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {canteen?.is_open ? 'Buka' : 'Tutup'}
                </span>
                <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-none flex items-center gap-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                  <Clock className="w-3 h-3" /> {canteen?.open_time?.substring(0,5) || '09:00'} - {canteen?.close_time?.substring(0,5) || '17:00'}
                </span>
                <button 
                  onClick={() => navigate({ to: '/dashboard/toko-saya/pesanan' })}
                  className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-none hover:bg-green-100 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Pesanan Masuk</span>
                  {activeOrdersCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-black px-1 py-0.2 rounded-none leading-tight shadow-xs animate-pulse">
                      {activeOrdersCount > 99 ? '99+' : activeOrdersCount}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => navigate({ to: '/dashboard/profile' })}
                  className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-none hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Pengaturan (Profil)
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1.5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center font-medium">
              <span className="text-yellow-500 mr-1">★</span>
              4.9 <span className="text-gray-400 ml-1 font-normal">(99+ Penilaian)</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-600 mr-1">📍</span>
              {canteen?.category ? `Zona ${canteen.category.toUpperCase()}` : 'Zona Belum Diatur'}
            </div>
          </div>
        </div>
      </div>

      {/* TABS & TOOLBAR PENCARIAN / OPEN ALL */}
      <div className="mt-4 bg-white dark:bg-gray-900 sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8">
          {/* Header Tab & Tombol Open All */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <div className="flex overflow-x-auto hide-scrollbar gap-1">
              {[
                { id: 'all', label: 'Semua Menu' },
                { id: 'popular', label: 'Paling Laris' }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button 
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-3 sm:px-4 py-2.5 whitespace-nowrap text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'border-green-600 text-green-600 dark:text-green-400' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {tab.id === 'popular' && (
                      <Flame className={`w-3.5 h-3.5 ${isActive ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
                    )}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tombol Toggle Open All Produk */}
            <div className="flex items-center gap-1.5 shrink-0 py-1">
              <button
                type="button"
                onClick={handleToggleShowAll}
                title={showAllProducts ? 'Kembalikan ke mode paginasi (10 menu per halaman)' : 'Buka dan tampilkan seluruh menu toko tanpa paginasi'}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-none border transition-all flex items-center gap-1 cursor-pointer ${
                  showAllProducts
                    ? 'bg-green-600 text-white border-green-700 shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{showAllProducts ? 'Mode: Buka Semua Menu (Aktif)' : 'Buka Semua Menu'}</span>
                <span className="sm:hidden">{showAllProducts ? 'Semua' : 'Open All'}</span>
              </button>
            </div>
          </div>

          {/* Baris Pencarian Produk */}
          <div className="py-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={activeTab === 'popular' ? "Cari dalam menu terlaris..." : "Cari nama menu, kategori sajian, atau deskripsi..."}
                className="w-full pl-8 pr-7 py-1 text-xs bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Menu Counter */}
            <div className="shrink-0 text-[10.5px] font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80 px-2 py-1 rounded-none border border-gray-200 dark:border-gray-700">
              <span className="font-bold text-gray-900 dark:text-white">{products.length}</span> Menu
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCT LIST */}
      <div className="mt-4 px-4 md:px-8 max-w-7xl mx-auto">
        {isLoadingProducts && !productsRes ? (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
            <LoadingSpinner 
              text="Memuat Menu Toko..." 
              subtext="Mengambil daftar sajian dan stok etalase" 
              minHeight="min-h-[160px]"
            />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center">
            <Store className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {searchTerm ? 'Menu Tidak Ditemukan' : activeTab === 'popular' ? 'Belum Ada Penjualan Menu' : 'Belum Ada Menu Ditambahkan'}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              {searchTerm 
                ? `Tidak ada sajian yang sesuai dengan kata kunci "${searchTerm}". Silakan periksa ejaan Anda.`
                : activeTab === 'popular'
                  ? 'Menu yang sering dipesan oleh santri akan otomatis muncul di sini berdasarkan urutan terlaris.'
                  : 'Tambahkan menu pertama Anda untuk mulai menerima pesanan.'}
            </p>
            {searchTerm ? (
              <button 
                onClick={() => handleSearchChange('')}
                className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-none transition-all cursor-pointer border border-gray-200 dark:border-gray-700"
              >
                Reset Pencarian
              </button>
            ) : (
              <button 
                onClick={openAddProduct}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider rounded-none transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Menu Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-none border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/80">
            {products.map((product, index) => (
              <div key={product.id} className="flex gap-3 group relative pt-4 first:pt-0">
                {/* Product Image */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-none bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                   <AppImage 
                     src={product.image} 
                     alt={product.name} 
                     type="food"
                     className="w-full h-full object-cover" 
                   />
                   {!product.is_available && (
                     <div className="absolute inset-0 bg-black/65 flex items-center justify-center backdrop-blur-[1px]">
                       <span className="text-white text-[9.5px] font-black px-2 py-0.5 bg-black/80 rounded-none border border-white/20 tracking-wider">HABIS</span>
                     </div>
                   )}
                </div>
                
                {/* Product Details */}
                <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                  <div>
                    {/* Badge Paling Laris */}
                    {activeTab === 'popular' && (
                      <div className="inline-flex items-center gap-1 mb-1 px-1.5 py-0.2 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-black rounded-none">
                        <Flame className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>Peringkat #{index + 1} Terlaris ({product.sold_count || 0}x Dipesan)</span>
                      </div>
                    )}

                    <h3 className={`text-sm sm:text-base font-bold truncate ${!product.is_available ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {product.name}
                    </h3>
                    
                    {/* Stock & Availability */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        Pesanan Aktif: <strong className="text-gray-900 dark:text-white">{product.stock || 0}</strong>
                      </span>
                      <span className="text-[10px] bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 px-1.5 py-0.2 rounded-none border border-green-200 dark:border-green-800 font-medium">
                        Dipesan: {product.sold_count || 0}x
                      </span>
                      {product.category && (
                        <span className="text-[10px] text-gray-400 truncate hidden sm:inline">
                          • {product.category}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {(() => {
                    const hpjVal = parseFloat(product.price || product.hpj || 0);
                    const hppVal = parseFloat(
                      product.hpp !== undefined && product.hpp !== null && parseFloat(product.hpp) > 0 
                        ? product.hpp 
                        : (hpjVal > 1000 ? hpjVal - 1000 : hpjVal)
                    );
                    const profitVal = hpjVal - hppVal;
                    return (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div>
                            <span className="text-[10px] text-gray-400 block leading-tight">HPJ (Jual)</span>
                            <span className={`font-mono font-bold text-sm ${!product.is_available ? 'text-gray-400' : 'text-green-700 dark:text-green-400'}`}>
                              Rp {hpjVal.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block leading-tight">HPP (Modal)</span>
                            <span className="font-mono font-semibold text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-none border border-amber-200 dark:border-amber-800/50 inline-block">
                              Rp {hppVal.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-0.5 text-gray-500 dark:text-gray-400">
                          <span>Keuntungan / porsi:</span>
                          <span className={`font-mono font-bold ${profitVal > 0 ? 'text-green-600 dark:text-green-400' : profitVal === 0 ? 'text-gray-500' : 'text-red-500'}`}>
                            {profitVal > 0 ? `+Rp ${profitVal.toLocaleString('id-ID')}` : `Rp ${profitVal.toLocaleString('id-ID')}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Management Actions */}
                  <div className="mt-2.5 flex gap-2">
                    <button 
                      onClick={() => openEditProduct(product)} 
                      className="flex-1 py-1 px-3 bg-gray-50 hover:bg-green-50 dark:bg-gray-800/80 dark:hover:bg-green-950/40 text-gray-700 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-300 text-xs font-bold rounded-none border border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id)} 
                      className="py-1 px-3 bg-gray-50 hover:bg-red-50 dark:bg-gray-800/80 dark:hover:bg-red-950/40 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-xs font-bold rounded-none border border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center cursor-pointer"
                      title="Hapus Menu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Pagination Controls / Open All Status */}
            {showAllProducts ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 pb-1 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">
                  Menampilkan seluruh <strong className="text-gray-900 dark:text-white font-mono">{products.length}</strong> menu toko sekaligus (Mode Buka Semua Menu).
                </span>
                <button
                  type="button"
                  onClick={handleToggleShowAll}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Kembalikan ke Paginasi
                </button>
              </div>
            ) : pagination && pagination.last_page > 1 ? (
              <div className="flex flex-wrap justify-between items-center gap-2 pt-4 pb-1 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={handleToggleShowAll}
                  className="text-[11px] font-bold text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3 h-3" />
                  <span>Buka Semua ({pagination.total} Menu)</span>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button 
                    onClick={() => setPage(old => Math.max(old - 1, 1))} 
                    disabled={page === 1} 
                    className="p-1.5 rounded-none border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <span className="text-xs font-bold font-mono text-gray-600 dark:text-gray-400">
                    {page} / {pagination.last_page}
                  </span>
                  <button 
                    onClick={() => setPage(old => (!productsRes || old === pagination.last_page ? old : old + 1))} 
                    disabled={page === pagination.last_page} 
                    className="p-1.5 rounded-none border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* FLOATING ACTION BUTTON (GoBiz Style) */}
      <button 
        onClick={openAddProduct}
        className="fixed bottom-20 lg:bottom-10 right-4 lg:right-10 px-3.5 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-none shadow-xl flex items-center gap-2 font-black text-xs uppercase tracking-wider border border-green-400/40 z-40 transition-all hover:scale-105 cursor-pointer"
        title="Tambah Menu Baru"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>Tambah Menu</span>
      </button>

      {/* Product Modal */}
      <ProductFormModal 
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        editingProduct={editingProduct}
        onSave={handleSaveProduct}
        isPending={saveProductMutation.isPending}
      />
    </div>
  );
}
