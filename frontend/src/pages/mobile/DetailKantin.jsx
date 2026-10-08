import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Store,
  Star,
  Clock,
  Info,
  X,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  Bike,
  AlertCircle,
  UtensilsCrossed,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import AppImage from '../../components/common/AppImage';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ProductOptionModal } from '../../components/modals/ProductOptionModal';

const hasVariants = (product) => {
  const cfg = product?.variant_config;
  if (!cfg) return false;
  return !!(
    cfg.spicy?.enabled ||
    cfg.temperature?.enabled ||
    cfg.portion?.enabled ||
    cfg.sugar?.enabled ||
    (cfg.custom?.enabled && cfg.custom?.groups?.length > 0)
  );
};

export default function DetailKantin() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const { addItem, removeItem, getCanteenItems, getTotalItems } = useCartStore();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariantProduct, setSelectedVariantProduct] = useState(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageError, setImageError] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Custom Order state (HiSend Titip Barang)
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customNotes, setCustomNotes] = useState('');
  const [customLocation, setCustomLocation] = useState(user?.santri_room || '');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);

  const { data: canteen, isLoading: isLoadingCanteen } = useQuery({
    queryKey: ['canteen', id],
    queryFn: async () => {
      const res = await api.get(`/canteens/${id}`);
      return res.data;
    }
  });

  // Extract unique categories (dynamic from products)
  const availableCategories = useMemo(() => {
    if (!canteen?.products) return ['Semua'];
    const cats = canteen.products
      .map(p => p.category?.trim())
      .filter(Boolean);
    return ['Semua', ...Array.from(new Set(cats))];
  }, [canteen?.products]);

  if (isLoadingCanteen) {
    return (
      <div className="bg-slate-50 dark:bg-gray-950 min-h-screen font-sans">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 sm:p-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: '/kantin' }))}
            className="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 cursor-pointer"
            title="Kembali"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Detail Toko & Menu</span>
        </div>
        <div className="p-3 sm:p-4 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-none shadow-xs">
            <LoadingSpinner 
              text="Memuat Menu Toko..." 
              subtext="Mengambil daftar sajian dan ketersediaan menu" 
              minHeight="min-h-[160px]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!canteen) {
    return (
      <div className="p-8 text-center text-gray-500 font-sans">
        <Store className="w-12 h-12 mx-auto text-gray-400 mb-2" />
        <p className="text-sm font-bold">Kantin tidak ditemukan.</p>
        <button
          onClick={() => navigate({ to: '/' })}
          className="mt-4 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-none"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  // Cart from global store for this specific canteen
  const canteenCart = getCanteenItems(canteen.id);
  const cartItems = Object.values(canteenCart);
  const canteenItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const canteenSubtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product?.price || 0) * item.quantity,
    0
  );

  const allTotalItems = getTotalItems();
  const totalItems = allTotalItems;
  const otherStoresItemsCount = Math.max(0, allTotalItems - canteenItemsCount);

  const handleAddToCart = (product) => {
    if (hasVariants(product)) {
      setSelectedVariantProduct(product);
      setIsVariantModalOpen(true);
      return;
    }

    const current = canteenCart[String(product.id)];
    const currentQty = current?.quantity || 0;
    if (currentQty >= 99) {
      toast.error('Maksimal pesanan untuk 1 menu adalah 99');
      return;
    }
    addItem(canteen, product);
    toast.success(`${product.name} dimasukkan ke keranjang`);
  };

  const handleConfirmVariant = ({ quantity, options, notes, extraPrice, variantKey }) => {
    if (!selectedVariantProduct) return;
    addItem(canteen, selectedVariantProduct, quantity, { variantKey, extraPrice, labels: options }, notes);
    toast.success(`${selectedVariantProduct.name} dimasukkan ke keranjang`);
    setIsVariantModalOpen(false);
    setSelectedVariantProduct(null);
  };

  const handleRemoveFromCart = (productId) => {
    removeItem(canteen.id, productId);
  };

  const handleGoToCart = () => {
    navigate({ to: token ? '/dashboard/keranjang' : '/keranjang' });
  };

  const filteredProducts =
    canteen.products?.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory =
        selectedCategory === 'Semua' ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());
      return matchSearch && matchCategory;
    }) || [];

  return (
    <div className="bg-slate-50 dark:bg-gray-950 min-h-screen pb-32 font-sans relative">
      {/* FLOATING & SOLID STICKY TOP NAVIGATION */}
      <div
        className={`fixed left-0 right-0 z-40 transition-all duration-200 ${
          originalAdmin ? 'top-[36px] sm:top-[40px]' : 'top-0'
        } ${
          isScrolled
            ? 'bg-gradient-to-r from-green-900 via-green-800 to-green-900 dark:from-gray-950 dark:via-emerald-950 dark:to-gray-950 border-b border-green-700/80 dark:border-gray-800 shadow-md py-2 px-3 sm:px-4'
            : 'bg-transparent p-2.5 sm:p-3 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: '/kantin' }))}
              className="pointer-events-auto w-8 h-8 bg-black/70 hover:bg-black text-white flex items-center justify-center rounded-none border border-white/20 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
              title="Kembali"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {isScrolled && (
              <div className="min-w-0 animate-fade-in">
                <h2 className="font-extrabold text-sm text-white tracking-tight leading-none drop-shadow-xs truncate">
                  {canteen.name}
                </h2>
                <p className="text-[10px] text-green-200 font-medium mt-0.5 truncate">
                  Antar ke Kamar • Rp {parseFloat(canteen.delivery_fee || 3000).toLocaleString('id-ID')}
                </p>
              </div>
            )}
          </div>

          {totalItems > 0 && (
            <button
              type="button"
              onClick={handleGoToCart}
              className="pointer-events-auto px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none flex items-center gap-1.5 shadow-md border border-white/20 transition-all text-xs font-bold shrink-0 cursor-pointer"
              title="Lihat Keranjang"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Keranjang ({totalItems})</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. STORE HERO BANNER (GoFood Resto Header) */}
      <div className="relative h-44 sm:h-52 bg-gray-900 border-b border-gray-200 dark:border-gray-800 max-w-4xl mx-auto">
        <AppImage
          src={canteen.image}
          alt={canteen.name || 'Banner Toko'}
          type="store"
          fallbackIcon={
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-r from-emerald-950 via-green-900 to-teal-950 relative overflow-hidden text-white">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute left-6 -bottom-6 w-24 h-24 bg-green-400/15 rounded-full blur-xl pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center mb-1.5 shadow-inner">
                  <Store className="w-6 h-6 text-emerald-300" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">Kantin & Toko Pondok</span>
              </div>
            </div>
          }
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`text-[9px] font-black px-1.5 py-0.2 uppercase tracking-wider ${
                canteen.is_open ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {canteen.is_open ? '● BUKA' : '● TUTUP'}
            </span>
            <span className="text-xs text-green-300 font-bold flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {parseFloat(canteen.rating || 4.8).toFixed(1)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-sm">
            {canteen.name}
          </h1>
          <p className="text-xs text-gray-200/90 line-clamp-1 mt-0.5">
            {canteen.description || 'Kantin resmi pondok pesantren Al-Mannan'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 space-y-3">
        {/* 2. RESTO INFO CHIPS (Delivery, Distance, Open Hours) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span>Antar ke Kamar</span>
            <span className="text-gray-300 dark:text-gray-700">•</span>
            <span className="font-mono font-bold text-green-700 dark:text-green-400">
              Rp {parseFloat(canteen.delivery_fee || 3000).toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>{canteen.open_time ? `${canteen.open_time.substring(0, 5)} - ${canteen.close_time?.substring(0, 5)}` : '08:00 - 21:00'}</span>
          </div>
        </div>

        {/* 2.1 PROMO VOUCHER BANNER (Gojek / GoFood Promo Ribbon) */}
        <div 
          onClick={() => navigate({ to: '/vouchers' })}
          className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-2 sm:p-2.5 flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🎟️</span>
            <div>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200 leading-tight">
                Diskon Ongkir & Kupon Belanja Santri
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                Klaim voucher untuk hemat biaya pesanan
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
            Klaim ➔
          </span>
        </div>

        {/* 3. SEARCH MENU IN CANTEEN */}
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 flex items-center gap-2 shadow-xs">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder={`Cari menu di ${canteen.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* 4. CUSTOM ORDER BANNER (HiSend Titip Barang Luar Menu) */}
        <div className="bg-gradient-to-r from-green-800 via-green-700 to-emerald-800 border border-green-900 p-3 text-white flex items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 px-1 py-0.2">
                HiSend
              </span>
              <span className="text-[10px] text-green-200 font-bold">Titip Beli / Menu Khusus</span>
            </div>
            <h3 className="font-bold text-xs sm:text-sm">Mau titip beli barang luar menu?</h3>
            <p className="text-[10px] text-green-100 line-clamp-1">Tulis catatan titipan, harga ditentukan oleh toko.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="px-3 py-1.5 bg-white text-green-800 hover:bg-green-50 active:scale-95 text-xs font-bold rounded-none shrink-0 shadow-sm transition-all"
          >
            ＋ Titip Beli
          </button>
        </div>

        {/* CATEGORY TABS (Dinamis Sesuai Kategori Toko) */}
        {availableCategories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-none border transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* 5. DAFTAR MENU (GoFood Food Item Card List) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4 text-green-600" />
              <h2 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                Daftar Menu Makanan & Minuman
              </h2>
            </div>
            <span className="text-xs text-gray-500 font-mono">{filteredProducts.length} Menu</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 text-xs">
              {searchQuery ? `Tidak ada menu "${searchQuery}" di kantin ini.` : 'Belum ada menu di kantin ini.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => {
                const inCart = canteenCart[String(product.id)]?.quantity || 0;
                const isAvailable = product.is_available === 1 || product.is_available === true;
                const productHasVariants = hasVariants(product);

                return (
                  <div
                    key={product.id}
                    className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 gap-3 hover:border-green-600 transition-colors"
                  >
                    {/* Kolom Kiri: Info Menu & Harga */}
                    <div className="flex-1 flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className={`font-bold text-xs sm:text-sm ${!isAvailable ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            {product.name}
                          </h3>
                          {productHasVariants && (
                            <span className="text-[9.5px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1 py-0.2 font-bold flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> Ada Varian
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-snug">
                          {product.description || 'Menu lezat & higienis khas kantin santri Al-Mannan'}
                        </p>
                      </div>

                      <div className="pt-2 mt-1 flex items-center justify-between">
                        <span className="font-mono font-bold text-xs sm:text-sm text-green-700 dark:text-green-400">
                          Rp {parseFloat(product.price).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Kolom Kanan: Foto Makanan & Tombol Tambah ala GoFood */}
                    <div className="w-24 sm:w-28 shrink-0 flex flex-col items-center justify-between">
                      <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden relative mb-1.5">
                        <AppImage
                          src={product.image}
                          alt={product.name}
                          type="food"
                          fallbackIcon={<UtensilsCrossed className="w-6 h-6 text-gray-400 dark:text-gray-500 opacity-50" />}
                          className="w-full h-full object-cover"
                        />
                        {!isAvailable && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] font-black text-white">
                            HABIS
                          </div>
                        )}
                      </div>

                      {/* Tombol Aksi Tambah / Qty ala GoFood */}
                      {isAvailable && (
                        <div className="w-full">
                          {productHasVariants ? (
                            <button
                              type="button"
                              onClick={() => handleAddToCart(product)}
                              className="w-full py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-[10.5px] uppercase tracking-wider rounded-none shadow-xs transition-colors active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-yellow-300" />
                              <span>{inCart > 0 ? `+ Opsi (${inCart})` : 'Pilih Varian'}</span>
                            </button>
                          ) : inCart > 0 ? (
                            <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/60 border border-green-600 px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(product.id)}
                                className="w-6 h-6 text-green-700 dark:text-green-300 font-bold hover:bg-green-100 flex items-center justify-center text-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono font-bold text-xs text-green-800 dark:text-green-200">
                                {inCart}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product)}
                                disabled={inCart >= 99}
                                className="w-6 h-6 text-green-700 dark:text-green-300 font-bold hover:bg-green-100 flex items-center justify-center text-xs disabled:opacity-30"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddToCart(product)}
                              className="w-full py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-none shadow-xs transition-colors active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tambah</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 6. FLOATING BOTTOM CART BAR (GoFood Order Summary Bar) */}
      {allTotalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-2.5 sm:p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-9 h-9 bg-green-600 text-white flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">
                  {canteenItemsCount > 0
                    ? `${canteenItemsCount} item di toko ini`
                    : `${otherStoresItemsCount} item di keranjang`}
                </p>
                <p className="text-sm font-extrabold text-gray-900 dark:text-white font-mono">
                  Rp {canteenSubtotal > 0 ? canteenSubtotal.toLocaleString('id-ID') : 'Lihat Total'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoToCart}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider rounded-none shadow-md transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <span>Keranjang ({allTotalItems})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 7. CUSTOM ORDER MODAL (HiSend Titip Beli Dialog) */}
      {showCustomModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-md p-4 space-y-3 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-green-600" />
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Titip Beli / Pesanan Khusus</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-green-50 dark:bg-green-950/40 p-2.5 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-300">
                Tuliskan barang atau pesanan khusus yang Anda perlukan di toko <strong>{canteen.name}</strong>. Pihak toko akan memeriksa dan menentukan total harganya.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Catatan Barang / Titipan <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Contoh: Tolong belikan Obat Flu 1 strip di apotek, atau Nasi Bungkus Lauk Telur..."
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Lokasi Pengantaran (Kamar)
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 py-2 rounded-none font-bold text-xs text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!customNotes.trim() || isSubmittingCustom}
                  onClick={async () => {
                    if (!token || !user) {
                      setShowCustomModal(false);
                      toast.error('Silakan login terlebih dahulu untuk membuat pesanan titipan/khusus.');
                      navigate({ to: '/login' });
                      return;
                    }
                    const isTeacherOrder = user?.is_teacher;
                    if (isTeacherOrder) {
                      if (!user?.phone || !user?.niy || !user?.teacher_unit) {
                        setShowCustomModal(false);
                        setShowProfileAlert(true);
                        return;
                      }
                    } else {
                      if (!user?.phone || !user?.santri_name || !user?.santri_room || !user?.santri_class || !user?.santri_level) {
                        setShowCustomModal(false);
                        setShowProfileAlert(true);
                        return;
                      }
                    }
                    if (!canteen.is_open) {
                      toast.error('Kantin sedang tutup');
                      return;
                    }
                    try {
                      setIsSubmittingCustom(true);
                      await api.post('/orders', {
                        canteen_id: canteen.id,
                        is_custom: true,
                        order_for: isTeacherOrder ? 'guru' : 'santri',
                        custom_notes: customNotes,
                        delivery_location: customLocation || (isTeacherOrder ? `Ruang Guru / Kantor ${user?.teacher_unit || 'Yayasan'}` : '')
                      });
                      toast.success('Pesanan khusus berhasil dibuat! Menunggu penentuan harga toko.');
                      setShowCustomModal(false);
                      setCustomNotes('');
                      navigate({ to: '/dashboard/pembayaran' });
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Gagal membuat pesanan khusus');
                    } finally {
                      setIsSubmittingCustom(false);
                    }
                  }}
                  className="flex-[2] py-2 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmittingCustom ? 'Mengirim...' : 'Kirim Titipan'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 8. PROFIL ALERT MODAL */}
      {showProfileAlert &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-sm p-4 text-center space-y-3 shadow-2xl">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-none flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Profil Santri Belum Lengkap</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Silakan lengkapi kamar santri dan WhatsApp di Profil sebelum mengirim pesanan.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileAlert(false)}
                  className="flex-1 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded-none border border-gray-200 dark:border-gray-700"
                >
                  Nanti Saja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileAlert(false);
                    navigate({ to: '/dashboard/profile' });
                  }}
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-none"
                >
                  Ke Profil
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 9. PRODUCT OPTION MODAL (Varian Dinamis & Preset) */}
      <ProductOptionModal
        isOpen={isVariantModalOpen}
        onClose={() => {
          setIsVariantModalOpen(false);
          setSelectedVariantProduct(null);
        }}
        product={selectedVariantProduct}
        onConfirm={handleConfirmVariant}
      />
    </div>
  );
}
