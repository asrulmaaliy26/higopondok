import React, { useState } from 'react';
import { Store, Save, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Star, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ProductFormModal } from '../../components/modals/ProductFormModal';
import { useCanteenStore } from '../../store/canteenStore';
import { useActiveOrdersCount } from '../../hooks/useActiveOrdersCount';
import AppImage from '../../components/common/AppImage';

export default function TokoSaya() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeCanteenId, setActiveCanteenId, isStoreSelected, setIsStoreSelected } = useCanteenStore();
  const [page, setPage] = useState(1);
  const activeOrdersCount = useActiveOrdersCount();

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



  // Product Form State (handled mostly in modal now, keeping simple state for toggling)
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');

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
    queryKey: ['products', page, activeCanteenId],
    queryFn: async () => {
      try {
        const res = await api.get(`/my-products?page=${page}&canteen_id=${activeCanteenId}`);
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
  const pagination = productsRes ? (productsRes.meta ? {
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

  if (isLoadingCanteen || (isLoadingProducts && !productsRes)) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>;
  }

  if (!isStoreSelected) {
    return (
      <div className="bg-gray-50 h-full min-h-screen dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 sticky top-0 z-20 shadow-xs px-2.5 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: '/dashboard' })} 
              className="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">Pilih Toko</h1>
          </div>
          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-none border border-gray-200 dark:border-gray-700">
            {canteensList.length} Toko
          </span>
        </div>
        
        <div className="p-2 max-w-2xl mx-auto space-y-1.5">
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
          ) : (
            canteensList.map(c => (
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

        {/* Top Navbar overlay */}
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 flex justify-between items-center z-10">
          <button 
            onClick={() => setIsStoreSelected(false)} 
            className="w-8 h-8 rounded-none bg-black/60 flex items-center justify-center text-white backdrop-blur-xs transition-colors hover:bg-black/80 shadow-xs border border-white/20 cursor-pointer"
            title="Ganti Toko"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-extrabold uppercase tracking-wider border border-white/20 backdrop-blur-xs">
            Merchant Partner
          </div>
        </div>
      </div>

      {/* STORE INFO CARD (Overlapping banner) */}
      <div className="px-2 sm:px-4 max-w-7xl mx-auto -mt-8 relative z-10">
        <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs p-2.5 sm:p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex-1">
              <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                {canteen?.name || 'Toko Saya'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 pr-2">
                {canteen?.description || 'Belum ada deskripsi.'}
              </p>

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

      {/* TABS */}
      <div className="mt-4 bg-white dark:bg-gray-900 sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex overflow-x-auto hide-scrollbar px-2">
          {['Semua Menu', 'Paling Laris'].map(tab => (
            <button 
              key={tab}
              onClick={() => {}}
              className={`px-4 py-3 whitespace-nowrap text-sm font-semibold border-b-2 transition-colors ${
                tab === 'Semua Menu'
                  ? 'border-green-600 text-green-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCT LIST */}
      <div className="mt-4 px-4 md:px-8 max-w-7xl mx-auto">
        {isLoadingProducts && !productsRes ? (
          <div className="space-y-4 bg-white dark:bg-gray-900 p-3 sm:p-5 rounded-none border border-gray-200 dark:border-gray-800">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center">
            <Store className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Belum Ada Menu Ditambahkan</p>
            <p className="text-xs text-gray-400 mt-1">Tambahkan menu pertama Anda untuk mulai menerima pesanan.</p>
            <button 
              onClick={openAddProduct}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider rounded-none transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Menu Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-none border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/80">
            {products.map((product) => (
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
            
            {/* Pagination Controls */}
            {pagination && pagination.last_page > 1 && (
              <div className="flex justify-center items-center gap-3 pt-4 pb-1">
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
            )}
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
