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
  Sparkles,
  Flame,
  Coffee,
  Utensils,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import AppImage from '../../components/common/AppImage';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ProductOptionModal } from '../../components/modals/ProductOptionModal';
import { hasVariants, getAvailableVariantPills } from '../../lib/variantUtils';

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
    if (!canteen?.is_open) {
      toast.error(canteen?.is_closed_today ? 'Toko sedang libur rutin hari ini' : 'Toko sedang tutup');
      return;
    }

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
    if (!canteen?.is_open) {
      toast.error(canteen?.is_closed_today ? 'Toko sedang libur rutin hari ini' : 'Toko sedang tutup');
      return;
    }
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
              {canteen.is_open ? '● BUKA' : (canteen.is_closed_today ? '● LIBUR HARI INI' : '● TUTUP')}
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
            <span>{canteen.open_time ? `${canteen.open_time.substring(0, 5)} - ${canteen.close_time?.substring(0, 5)} WIB` : '06:00 - 21:00 WIB'}</span>
            {canteen.closed_days && canteen.closed_days.length > 0 && (
              <span className="text-red-500 font-semibold ml-1">
                (Libur: {canteen.closed_days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')})
              </span>
            )}
          </div>
        </div>

        {/* Banner Libur Rutin */}
        {canteen.is_closed_today && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-2.5 flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
            <span className="text-base">📅</span>
            <div>
              <p className="font-bold leading-tight">Toko Sedang Libur Rutin Hari Ini</p>
              <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                Toko ini memiliki jadwal libur rutin hari ini. Pemesanan menu reguler ditutup sementara.
              </p>
            </div>
          </div>
        )}

        {/* Banner Titip Beli / Pesanan Khusus Saat Toko Tutup (24 Jam) */}
        {!canteen.is_open && (
          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800/80 p-2.5 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">🛍️</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-purple-950 dark:text-purple-200 leading-tight truncate">
                  Toko Tutup? Tetap Bisa Titip Beli!
                </p>
                <p className="text-[10px] text-purple-700 dark:text-purple-300 leading-tight mt-0.5">
                  Buat pesanan khusus 24 jam. Kurir akan berbelanja & mengantar pada jadwal kurir.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: '/kantin', search: { custom_canteen: String(canteen.id) } })}
              className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-[11px] rounded-none shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1"
            >
              <span>Titip Beli</span>
              <span>➔</span>
            </button>
          </div>
        )}

        {/* 2.1 PROMO VOUCHER BANNER (Gojek / GoFood Promo Ribbon) */}
        <div 
          onClick={() => navigate({ to: token ? '/dashboard/vouchers' : '/vouchers' })}
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
                const cartItemsForThisProduct = Object.entries(canteenCart || {})
                  .filter(([key]) => key === String(product.id) || key.startsWith(`${product.id}_`))
                  .map(([key, item]) => ({
                    key,
                    quantity: item.quantity || 0,
                    options: item.options || [],
                    notes: item.notes || ''
                  }));
                const inCart = cartItemsForThisProduct.reduce((sum, item) => sum + item.quantity, 0);
                const isAvailable = product.is_available === 1 || product.is_available === true;
                const productHasVariants = hasVariants(product);
                const variantPills = productHasVariants ? getAvailableVariantPills(product) : [];

                return (
                  <div
                    key={product.id}
                    className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 gap-3 hover:border-green-600 transition-colors"
                  >
                    {/* Kolom Kiri: Info Menu & Harga */}
                    <div className="flex-1 flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 
                            onClick={() => isAvailable && handleAddToCart(product)}
                            className={`font-bold text-xs sm:text-sm ${isAvailable ? 'cursor-pointer hover:text-green-600 transition-colors text-gray-900 dark:text-white' : 'text-gray-400'}`}
                          >
                            {product.name}
                          </h3>
                          {productHasVariants && (
                            <button
                              type="button"
                              onClick={() => isAvailable && handleAddToCart(product)}
                              className="text-[9.5px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 font-bold flex items-center gap-0.5 rounded-none hover:bg-purple-100 dark:hover:bg-purple-900/60 cursor-pointer transition-colors"
                              title="Klik untuk melihat & memilih opsi varian"
                            >
                              <Sparkles className="w-2.5 h-2.5" /> Ada Varian
                            </button>
                          )}
                        </div>
                        <p 
                          onClick={() => isAvailable && handleAddToCart(product)}
                          className={`text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-snug ${isAvailable ? 'cursor-pointer' : ''}`}
                        >
                          {product.description || 'Menu lezat & higienis khas kantin santri Al-Mannan'}
                        </p>

                        {/* Deskripsi Opsi Varian yang Tersedia untuk Dipilih */}
                        {productHasVariants && variantPills.length > 0 && (
                          <div
                            onClick={() => isAvailable && handleAddToCart(product)}
                            className={`mt-1.5 flex flex-wrap gap-1 items-center ${isAvailable ? 'cursor-pointer' : ''}`}
                          >
                            <span className="text-[9.5px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-purple-500" /> Pilihan:
                            </span>
                            {variantPills.map((pill, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800/80 rounded-none text-[10px] font-medium"
                              >
                                {pill.type === 'spicy' && <Flame className="w-2.5 h-2.5 text-red-500 shrink-0" />}
                                {pill.type === 'temperature' && <Coffee className="w-2.5 h-2.5 text-blue-500 shrink-0" />}
                                {pill.type === 'portion' && <Utensils className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                {pill.type !== 'spicy' && pill.type !== 'temperature' && pill.type !== 'portion' && (
                                  <Sparkles className="w-2.5 h-2.5 text-purple-500 shrink-0" />
                                )}
                                <span>{pill.label}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Rincian Varian yang Sudah Dipilih ke Keranjang */}
                        {cartItemsForThisProduct.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                            <span className="text-[9.5px] font-bold text-green-700 dark:text-green-300 uppercase tracking-wider flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Terpilih:
                            </span>
                            {cartItemsForThisProduct.map((cartItem) => (
                              <span
                                key={cartItem.key}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-none text-[10px] font-mono font-bold"
                              >
                                <span className="bg-green-600 text-white px-1 py-0.1 text-[9px]">
                                  {cartItem.quantity}x
                                </span>
                                <span>
                                  {cartItem.options && cartItem.options.length > 0
                                    ? cartItem.options.join(', ')
                                    : 'Standar'}
                                </span>
                                {cartItem.notes && (
                                  <span className="text-[9px] text-gray-500 dark:text-gray-400 font-sans italic font-normal">
                                    ({cartItem.notes})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs sm:text-sm text-green-700 dark:text-green-400">
                          Rp {parseFloat(product.price).toLocaleString('id-ID')}
                        </span>
                        {Boolean(product.sold_count && product.sold_count > 0) && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-none text-[9.5px] font-bold font-mono">
                            <Flame className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />
                            <span>{product.sold_count}x dipesan</span>
                          </span>
                        )}
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
                          {!canteen?.is_open ? (
                            <button
                              type="button"
                              disabled
                              className="w-full py-1 bg-gray-100 dark:bg-gray-800 text-gray-400 font-bold text-[10px] uppercase tracking-wider rounded-none cursor-not-allowed border border-gray-200 dark:border-gray-700"
                            >
                              {canteen?.is_closed_today ? 'Libur Hari Ini' : 'Toko Tutup'}
                            </button>
                          ) : productHasVariants ? (
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
