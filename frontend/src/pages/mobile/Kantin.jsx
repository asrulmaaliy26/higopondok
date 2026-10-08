import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MapPin, 
  Search, 
  UtensilsCrossed, 
  Store, 
  ChevronLeft, 
  ShoppingCart, 
  Sparkles,
  ChevronRight,
  ChevronDown,
  Star,
  Clock,
  Coffee,
  X,
  Send,
  Package,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import axios from '../../lib/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import PublicBottomNav from '../../components/layout/mobile/PublicBottomNav';
import AppImage from '../../components/common/AppImage';
import PromoBannerCarousel from '../../components/common/PromoBannerCarousel';

// Helper pengecekan kategori menu produk
function isProductInCategory(p, category) {
  if (!category || category === 'semua' || category === 'buka') return true;
  const pCat = (p.category || '').toLowerCase();
  const text = ((p.name || '') + ' ' + (p.description || '') + ' ' + pCat).toLowerCase();

  if (category === 'makanan') {
    if (pCat.includes('makan') || pCat.includes('food') || pCat.includes('lauk') || pCat.includes('berat')) return true;
    return text.includes('nasi') || text.includes('mie') || text.includes('ayam') || text.includes('soto') || text.includes('bebek') || text.includes('makan') || text.includes('geprek') || text.includes('padang') || text.includes('bakso') || text.includes('penyet') || text.includes('lele') || text.includes('steak');
  }
  if (category === 'minuman') {
    if (pCat.includes('minum') || pCat.includes('drink') || pCat.includes('beverage')) return true;
    return text.includes('es') || text.includes('teh') || text.includes('tea') || text.includes('kopi') || text.includes('coffee') || text.includes('jus') || text.includes('juice') || text.includes('susu') || text.includes('air') || text.includes('drink') || text.includes('lemonade') || text.includes('latte') || text.includes('degan') || text.includes('milo') || text.includes('matcha') || text.includes('nescafe');
  }
  if (category === 'snack') {
    if (pCat.includes('snack') || pCat.includes('camilan') || pCat.includes('cemilan')) return true;
    return text.includes('snack') || text.includes('camilan') || text.includes('roti') || text.includes('keripik') || text.includes('gorengan') || text.includes('dimsum') || text.includes('siomay') || text.includes('lumpia') || text.includes('martabak') || text.includes('terang bulan') || text.includes('seblak');
  }
  return true;
}

export default function Kantin() {
  const navigate = useNavigate();
  const location = useLocation();
  const isInsideDashboard = location.pathname.startsWith('/dashboard');
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const totalCartItems = getTotalItems();

  // Inisialisasi kategori dari query parameter URL (?category=minuman)
  const getCategoryFromUrl = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('category') || 'semua';
    }
    return 'semua';
  };

  const [selectedCategory, setSelectedCategory] = useState(getCategoryFromUrl);
  const [searchQuery, setSearchQuery] = useState('');

  // State Pesanan Khusus
  const queryClient = useQueryClient();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCanteenId, setCustomCanteenId] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customLocation, setCustomLocation] = useState(user?.santri_room || '');
  const [customBudget, setCustomBudget] = useState('');

  // Update default lokasi pengantaran jika data user baru selesai dimuat
  useEffect(() => {
    if (user?.santri_room && !customLocation) {
      setCustomLocation(user.santri_room);
    }
  }, [user]);

  // Sinkronisasi saat URL berubah
  useEffect(() => {
    const handlePopState = () => {
      setSelectedCategory(getCategoryFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    const url = new URL(window.location.href);
    if (catId === 'semua') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', catId);
    }
    window.history.pushState({}, '', url.toString());
  };

  // Fetch Banners (Approved)
  const { data: banners, isLoading: loadingBanners } = useQuery({
    queryKey: ['canteen-banners'],
    queryFn: async () => {
      const res = await axios.get('/banners');
      return res.data || [];
    }
  });

  // Fetch Canteens with products
  const { data: canteens = [], isLoading: loadingCanteens } = useQuery({
    queryKey: ['canteens'],
    queryFn: async () => {
      const res = await axios.get('/canteens');
      return res.data.data || res.data || [];
    }
  });

  // Mutation Buat Pesanan Khusus
  const submitCustomOrderMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.post('/orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Pesanan khusus berhasil diajukan! Menunggu penentuan harga dari toko.');
      setShowCustomModal(false);
      setCustomNotes('');
      setCustomBudget('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-orders'] });
      if (data?.order?.id) {
        navigate({ to: '/pembayaran', search: { order_id: data.order.id } });
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Gagal mengajukan pesanan khusus. Silakan periksa kelengkapan profil Anda.';
      toast.error(msg);
    }
  });

  const handleOpenCustomModal = () => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu untuk membuat pesanan khusus');
      navigate({ to: '/login' });
      return;
    }
    setShowCustomModal(true);
  };

  const handleSubmitCustomOrder = (e) => {
    e.preventDefault();
    if (!customNotes.trim()) {
      toast.error('Mohon tulis rincian pesanan khusus Anda.');
      return;
    }
    const loc = customLocation.trim() || user?.santri_room || 'Kamar Santri';
    if (!loc) {
      toast.error('Mohon cantumkan lokasi pengantaran / kamar santri.');
      return;
    }

    // Tentukan toko/kantin tujuan
    let targetCanteenId = customCanteenId;
    const isAutoSelectedByCanteen = !targetCanteenId;
    if (!targetCanteenId) {
      const defaultPusat = Array.isArray(canteens) ? canteens.find(c => c.id === 173 || (c.name || '').toLowerCase().includes('pusat')) : null;
      targetCanteenId = defaultPusat?.id || (Array.isArray(canteens) && canteens.length > 0 ? canteens[0].id : 173);
    }

    const notesWithBudget = customBudget.trim()
      ? `${customNotes.trim()}\n(Estimasi Anggaran: Rp ${customBudget.trim()})`
      : customNotes.trim();

    const finalNotes = isAutoSelectedByCanteen
      ? `[Toko: Bebas / Dipilihkan Kantin]\n${notesWithBudget}`
      : notesWithBudget;

    submitCustomOrderMutation.mutate({
      canteen_id: targetCanteenId,
      is_custom: true,
      custom_notes: finalNotes,
      delivery_location: loc,
    });
  };

  // Judul dinamis ala Gojek GoFood (Resto yang ada Minuman)
  const getCategoryTitle = () => {
    switch (selectedCategory) {
      case 'minuman':
        return 'Resto yang ada Minuman';
      case 'makanan':
        return 'Resto yang ada Makanan';
      case 'snack':
        return 'Resto yang ada Camilan';
      case 'buka':
        return 'Resto yang Sedang Buka';
      default:
        return 'Semua Kantin & Toko';
    }
  };

  // Filter canteens:
  // Hanya menampilkan kantin yang memiliki produk sesuai kategori terpilih!
  const filteredCanteens = useMemo(() => {
    if (!Array.isArray(canteens)) return [];

    return canteens
      .map((canteen) => {
        const canteenProducts = Array.isArray(canteen.products) 
          ? canteen.products 
          : (canteen.products && typeof canteen.products === 'object' ? Object.values(canteen.products) : []);
        
        // Produk yang cocok dengan kategori yang sedang aktif
        const matchingProducts = canteenProducts.filter((p) => {
          if (!p?.is_available) return false;
          return isProductInCategory(p, selectedCategory);
        });

        return {
          ...canteen,
          products: canteenProducts,
          matchingProducts,
          hasMatchingProducts: selectedCategory === 'semua' || selectedCategory === 'buka' 
            ? true 
            : matchingProducts.length > 0
        };
      })
      .filter((c) => {
        const query = searchQuery ? searchQuery.toLowerCase() : '';
        // Filter pencarian teks
        const matchSearch =
          !query ||
          (c.name && c.name.toLowerCase().includes(query)) ||
          (c.description && c.description.toLowerCase().includes(query)) ||
          (Array.isArray(c.products) && c.products.some((p) => p?.name && p.name.toLowerCase().includes(query)));

        if (!matchSearch) return false;

        // Filter status buka jika kategori 'buka'
        if (selectedCategory === 'buka' && !c.is_open) {
          return false;
        }

        // Filter hanya toko yang punya produk dalam kategori yang dipilih!
        return c.hasMatchingProducts;
      });
  }, [canteens, searchQuery, selectedCategory]);

  return (
    <div className="pb-28 bg-slate-50 dark:bg-gray-950 min-h-screen font-sans">
      {/* 1. STICKY TOP HEADER (Gojek / ShopeeFood Style - Tetap Menempel di Atas Saat Discroll) */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-green-900 via-green-800 to-green-900 dark:from-gray-950 dark:via-emerald-950 dark:to-gray-950 border-b border-green-700/80 dark:border-gray-800 shadow-md">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          {/* Top Bar Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: '/' }))}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-none border border-white/20 backdrop-blur-xs transition-all shadow-xs cursor-pointer"
              title="Kembali"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-none drop-shadow-xs">
                {getCategoryTitle()}
              </h1>
              <p className="text-[10px] text-green-200 font-medium mt-0.5">
                Santri PPTQ Al-Mannan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-xs border border-white/20 px-2.5 py-1 text-xs text-white max-w-[180px] shadow-xs">
              <MapPin size={13} className="text-emerald-300 shrink-0" />
              <span className="truncate text-[11px] font-semibold">
                {user?.santri_room || 'Asrama Santri'}
              </span>
            </div>

            <Link
              to={user ? "/dashboard/keranjang" : "/keranjang"}
              className="relative p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 backdrop-blur-xs text-white transition-all shadow-xs"
              title="Keranjang"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-400 text-green-950 font-mono text-[9px] font-black w-4 h-4 flex items-center justify-center border border-green-800 leading-none shadow-xs">
                  {totalCartItems > 99 ? '99+' : totalCartItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* BANNER PROMO SECTION */}
      <div className="bg-gradient-to-b from-green-800 via-green-700 to-green-800 dark:from-green-950 dark:via-emerald-950 dark:to-gray-950 pt-2 pb-5 px-0 sm:px-2 border-b border-green-800/80 shadow-inner">
        <div className="max-w-5xl mx-auto">
          {/* Banner Promo Carousel (Focused in Center with Left & Right Peek, Widescreen & Prominent) */}
          <PromoBannerCarousel
            banners={banners}
            isLoading={loadingBanners}
            heightClass="h-40 sm:h-52 md:h-56"
            mobileRatio={0.92}
            tabletRatio={0.88}
            desktopRatio={0.82}
            titleSizeClass="text-xs sm:text-sm"
            badgeSizeClass="text-[9.5px] sm:text-[10px]"
            cardPaddingClass="p-2.5 sm:p-3.5"
            onBannerClick={(banner) => {
              if (banner?.canteen_id) {
                navigate({ to: '/kantin/$canteenId', params: { canteenId: String(banner.canteen_id) } });
              }
            }}
          />
        </div>
      </div>

      {/* 2. MAIN BODY SECTION */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 -mt-3 relative z-20 space-y-3">
        {/* SEARCH BAR (Flat & Sharp) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 flex items-center gap-2 shadow-xs">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari kantin atau menu ${selectedCategory === 'semua' ? '' : selectedCategory}...`}
            className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold px-1"
            >
              ✕
            </button>
          ) : (
            <UtensilsCrossed size={16} className="text-green-600 shrink-0" />
          )}
        </div>

        {/* BARIS FILTER KATEGORI (DROPDOWN) & TOMBOL PESANAN KHUSUS (UNGU) */}
        <div className="flex items-center gap-2">
          {/* Dropdown Kategori */}
          <div className="relative flex-1">
            <select
              value={selectedCategory}
              onChange={(e) => handleSelectCategory(e.target.value)}
              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold uppercase tracking-wider py-2 pl-3 pr-8 rounded-none appearance-none outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 cursor-pointer shadow-xs transition-colors"
            >
              <option value="semua">🏪 Semua Toko</option>
              <option value="buka">🟢 Kantin Buka</option>
              <option value="makanan">🍲 Makanan</option>
              <option value="minuman">🥤 Minuman</option>
              <option value="snack">✨ Camilan</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Button Pesanan Khusus Warna Ungu */}
          <button
            type="button"
            onClick={handleOpenCustomModal}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 rounded-none flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>Pesanan Khusus</span>
          </button>
        </div>

        {/* 3. DAFTAR RESTO / KANTIN ALA GOJEK GOFOOD (GAMBAR 1) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-green-600" />
              <span>{getCategoryTitle()}</span>
            </h2>
            <span className="text-[11px] text-gray-500 font-mono font-semibold">
              {filteredCanteens.length} Toko
            </span>
          </div>

          {loadingCanteens && filteredCanteens.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <LoadingSpinner 
                text="Memuat Daftar Toko & Menu..." 
                subtext="Mencari kantin yang sedang buka di pondok" 
                minHeight="min-h-[200px]"
              />
            </div>
          ) : filteredCanteens.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <UtensilsCrossed className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Tidak ada kantin untuk kategori ini
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {searchQuery 
                  ? `Tidak ada kantin yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Belum ada toko yang menyediakan menu dari kategori ini.'}
              </p>
              <button
                type="button"
                onClick={() => handleSelectCategory('semua')}
                className="mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Lihat Semua Kantin
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCanteens.map((canteen) => {
                const canteenProducts = Array.isArray(canteen.products)
                  ? canteen.products
                  : (canteen.products && typeof canteen.products === 'object' ? Object.values(canteen.products) : []);

                // Tentukan produk preview yang akan ditampilkan di card (maksimal 4 item ala Gojek Gambar 1)
                const previewProducts = (
                  Array.isArray(canteen.matchingProducts) && canteen.matchingProducts.length > 0
                    ? canteen.matchingProducts
                    : canteenProducts.filter((p) => p?.is_available)
                ).slice(0, 4);

                return (
                  <div
                    key={canteen.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-green-600 p-3 sm:p-3.5 transition-colors shadow-2xs"
                  >
                    {/* Header Kantin */}
                    <Link
                      to={`/kantin/${canteen.id}`}
                      className="flex items-start gap-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-800 group cursor-pointer"
                    >
                      {/* Logo Toko */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                        <AppImage
                          src={canteen.image}
                          alt={canteen.name}
                          type="store"
                          fallbackIcon={<Store size={24} className="text-gray-400 dark:text-gray-500" />}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      {/* Detail Info Kantin */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                            {canteen.name}
                          </h3>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider shrink-0 ${
                              canteen.is_open
                                ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border border-green-300 dark:border-green-800'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800'
                            }`}
                          >
                            {canteen.is_open ? 'Buka' : 'Tutup'}
                          </span>
                        </div>

                        {/* Rating & Estimasi ala Gojek */}
                        <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400 mb-1">
                          <div className="flex items-center gap-0.5 text-amber-500 font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{canteen.rating && parseFloat(canteen.rating) > 0 ? canteen.rating : '4.9'}</span>
                          </div>
                          <span>•</span>
                          <span className="text-gray-500">
                            Ongkir Rp {parseFloat(canteen.delivery_fee || 2000).toLocaleString('id-ID')}
                          </span>
                          <span>•</span>
                          <span className="text-gray-500">
                            {canteen.category === 'kota' ? 'Area Kota' : 'Area Kauman'}
                          </span>
                        </div>

                        {/* Jam Operasional */}
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>
                            {canteen.open_time ? canteen.open_time.substring(0, 5) : '09:00'} - {canteen.close_time ? canteen.close_time.substring(0, 5) : '21:00'} WIB
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* MENU PRODUCT PREVIEW ROW (Persis Seperti Gambar 1 Gojek GoFood) */}
                    {previewProducts.length > 0 && (
                      <div className="pt-2.5">
                        <div className="grid grid-cols-4 gap-2">
                          {previewProducts.map((prod) => (
                            <Link
                              key={prod.id}
                              to={`/kantin/${canteen.id}`}
                              className="flex flex-col group cursor-pointer"
                            >
                              {/* Foto Menu Kotak (Rounded None) */}
                              <div className="aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden relative mb-1">
                                <AppImage
                                  src={prod.image}
                                  alt={prod.name}
                                  type="food"
                                  fallbackIcon={<UtensilsCrossed className="w-5 h-5 text-gray-400 opacity-50" />}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>

                              {/* Harga Produk */}
                              <span className="text-[11px] sm:text-xs font-mono font-extrabold text-gray-900 dark:text-white leading-tight">
                                {parseFloat(prod.price).toLocaleString('id-ID')}
                              </span>

                              {/* Nama Produk */}
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium line-clamp-1 uppercase tracking-tight mt-0.5 group-hover:text-green-600 transition-colors">
                                {prod.name}
                              </span>
                            </Link>
                          ))}
                        </div>

                        {/* Link Buka Menu Lengkap */}
                        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                          <Link
                            to={`/kantin/${canteen.id}`}
                            className="text-green-700 dark:text-green-400 font-bold hover:underline flex items-center gap-0.5"
                          >
                            <span>Lihat menu lainnya ({canteen.products?.length || 0})</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {canteen.is_open ? 'Siap Dipesan' : 'Buka Jam ' + (canteen.open_time?.substring(0, 5) || '09:00')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL PESANAN KHUSUS (FLAT & SHARP - HIGH DENSITY) */}
      {showCustomModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 shadow-2xl rounded-none flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header Modal */}
            <div className="px-4 py-3 bg-purple-700 text-white flex items-center justify-between border-b border-purple-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-200" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Pesanan Khusus Wali & Santri
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white hover:bg-purple-800 rounded-none transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Modal */}
            <form onSubmit={handleSubmitCustomOrder} className="p-4 space-y-3.5 overflow-y-auto">
              {/* Petunjuk Ringkas */}
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 text-xs">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                  Titip Belanja Bebas / Menu Khusus
                </p>
                <p className="text-[11px] leading-relaxed text-purple-800 dark:text-purple-300">
                  Ingin titip belanja di luar daftar menu atau barang khusus? Tulis pesanan Anda. Jika tidak memilih toko, pengelola kantin yang akan memilihkannya, memverifikasi ketersediaan barang, dan menentukan total harga tagihan.
                </p>
              </div>

              {/* Opsi Pilih Toko (Opsional / Kantin yang Memilihkan) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-1">
                  Pilih Toko <span className="text-[10px] text-gray-500 font-normal normal-case">(Opsional - jika tidak dipilih, kantin yang akan memilihkannya)</span>
                </label>
                <div className="relative">
                  <select
                    value={customCanteenId}
                    onChange={(e) => setCustomCanteenId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-xs font-semibold py-2 pl-3 pr-8 rounded-none appearance-none outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-gray-900 cursor-pointer"
                  >
                    <option value="">🏪 Bebas (Kantin yang akan memilihkannya)</option>
                    {Array.isArray(canteens) && canteens
                      .filter((c) => c.id !== 173 && !(c.name || '').toLowerCase().includes('pusat'))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.is_open ? '🟢 (Buka)' : '⚪ (Tutup)'}
                        </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Catatan / Rincian Pesanan Khusus */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-1">
                  Rincian Barang / Makanan <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Contoh: Tolong belikan sabun mandi Lifebuoy 2 pcs, obat flu di apotek, dan roti tawar..."
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-xs p-2.5 rounded-none outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                />
              </div>

              {/* Lokasi Pengantaran / Kamar Santri */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-1">
                  Lokasi Pengantaran / Kamar Santri <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Contoh: Asrama Umar Kamar 04 / Ruang Guru"
                    required
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-xs py-2 pl-8 pr-3 rounded-none outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-gray-900"
                  />
                  <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Estimasi Anggaran (Opsional) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-1">
                  Perkiraan Anggaran / Budget <span className="text-[10px] text-gray-500 font-normal normal-case">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={customBudget}
                  onChange={(e) => setCustomBudget(e.target.value)}
                  placeholder="Contoh: 30000 atau Rp 50.000"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-xs py-2 px-3 rounded-none outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-gray-900"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  disabled={submitCustomOrderMutation.isPending}
                  className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase tracking-wider rounded-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitCustomOrderMutation.isPending}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-none flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  {submitCustomOrderMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Pesanan Khusus</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {!isInsideDashboard && <PublicBottomNav />}
    </div>
  );
}
