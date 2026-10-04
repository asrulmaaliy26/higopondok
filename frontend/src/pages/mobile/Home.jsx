import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Search,
  MapPin,
  Store,
  ShoppingCart,
  ChevronRight,
  UtensilsCrossed,
  Plus,
  Minus,
  Check,
  Star,
  Clock,
  Sparkles,
  BookOpen,
  LogIn,
  User,
  Coffee,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Bike,
  Ticket,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios, { getStorageUrl } from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { usePwaStore } from '../../store/pwaStore';
import AppImage from '../../components/common/AppImage';
import ThemeToggle from '../../components/ui/ThemeToggle';
import ActiveCartFloatingBanner from '../../components/cart/ActiveCartFloatingBanner';
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

export default function Home() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const { isStandalone, installApp } = usePwaStore();

  const { cart, addItem, removeItem, getCanteenItems, getTotalItems } = useCartStore();
  const totalCartItems = getTotalItems();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('semua');
  const [selectedOptionProduct, setSelectedOptionProduct] = useState(null);
  const [selectedOptionCanteen, setSelectedOptionCanteen] = useState(null);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const scrollContainerRef = useRef(null);

  // 1. Fetch Banners (Approved)
  const { data: banners = [], isLoading: loadingBanners } = useQuery({
    queryKey: ['canteen-banners'],
    queryFn: async () => {
      const res = await axios.get('/banners');
      return res.data || [];
    }
  });

  // 2. Fetch Canteens with products
  const { data: canteens = [], isLoading: loadingCanteens } = useQuery({
    queryKey: ['canteens'],
    queryFn: async () => {
      const res = await axios.get('/canteens');
      return res.data.data || res.data || [];
    }
  });

  // Auto slide banner promo
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollContainerRef.current.scrollBy({ left: clientWidth, behavior: 'smooth' });
        }
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [banners]);

  // Flatten popular products across open canteens
  const allProducts = React.useMemo(() => {
    if (!Array.isArray(canteens)) return [];
    const list = [];
    canteens.forEach((canteen) => {
      if (Array.isArray(canteen.products)) {
        canteen.products.forEach((prod) => {
          list.push({
            ...prod,
            canteen
          });
        });
      }
    });
    return list;
  }, [canteens]);

  // Filter canteens
  const filteredCanteens = React.useMemo(() => {
    if (!Array.isArray(canteens)) return [];
    return canteens.filter((c) => {
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedCategory === 'buka') {
        return Boolean(c.is_open);
      }
      return true;
    });
  }, [canteens, searchQuery, selectedCategory]);

  // Filter products by search & category
  const filteredProducts = React.useMemo(() => {
    return allProducts.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.canteen?.name && p.canteen.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedCategory === 'makanan') {
        if (p.category && p.category.toLowerCase().includes('makan')) return true;
        const text = (p.name + ' ' + (p.description || '')).toLowerCase();
        return text.includes('nasi') || text.includes('mie') || text.includes('ayam') || text.includes('soto') || text.includes('makan') || text.includes('geprek');
      }
      if (selectedCategory === 'minuman') {
        if (p.category && p.category.toLowerCase().includes('minum')) return true;
        const text = (p.name + ' ' + (p.description || '')).toLowerCase();
        return text.includes('es') || text.includes('teh') || text.includes('kopi') || text.includes('jus') || text.includes('susu') || text.includes('air') || text.includes('drink');
      }
      if (selectedCategory === 'snack') {
        if (p.category && p.category.toLowerCase().includes('snack')) return true;
        const text = (p.name + ' ' + (p.description || '')).toLowerCase();
        return text.includes('snack') || text.includes('roti') || text.includes('keripik') || text.includes('gorengan') || text.includes('camilan');
      }
      return true;
    });
  }, [allProducts, searchQuery, selectedCategory]);

  const handleAddToCart = (canteen, product) => {
    if (hasVariants(product)) {
      setSelectedOptionCanteen(canteen);
      setSelectedOptionProduct(product);
      setIsOptionModalOpen(true);
      return;
    }
    addItem(canteen, product);
    toast.success(`${product.name} dimasukkan ke keranjang`, {
      duration: 1800,
      position: 'bottom-center'
    });
  };

  const handleConfirmVariant = ({ quantity, options, notes, extraPrice, variantKey }) => {
    if (!selectedOptionProduct || !selectedOptionCanteen) return;
    addItem(selectedOptionCanteen, selectedOptionProduct, quantity, { variantKey, extraPrice, labels: options }, notes);
    toast.success(`${selectedOptionProduct.name} dimasukkan ke keranjang`, {
      duration: 1800,
      position: 'bottom-center'
    });
    setIsOptionModalOpen(false);
    setSelectedOptionProduct(null);
    setSelectedOptionCanteen(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans pb-28 selection:bg-green-200">
      {/* 1. TOP HEADER NAVIGATION (Compact & Flat Sharp) */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-transparent.png" alt="HiGO" className="h-8 w-8 object-contain" />
            <div>
              <span className="font-black text-lg text-gray-900 dark:text-white tracking-tight">
                Hi<span className="text-green-600">GO</span> <span className="font-semibold text-sm text-gray-600 dark:text-gray-300">Pondok</span>
              </span>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none font-medium hidden sm:block">
                Kantin & Jajanan Al-Mannan
              </p>
            </div>
          </Link>

          {/* Room Location Bar (Santri / Guest) */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-xs font-semibold text-green-800 dark:text-green-300">
            <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span className="truncate max-w-[200px]">
              {user?.santri_room ? `Kamar: ${user.santri_room}` : 'Pesantren Al-Mannan'}
            </span>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle size="sm" />

            {/* Cart Button */}
            <Link
              to="/keranjang"
              className="relative p-2 text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 transition-colors"
              title="Keranjang Belanja"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-green-600 text-white font-mono text-[10px] font-black w-4 h-4 flex items-center justify-center border border-white dark:border-gray-900 leading-none">
                  {totalCartItems > 99 ? '99+' : totalCartItems}
                </span>
              )}
            </Link>

            {/* Auth CTA */}
            {token ? (
              <Link
                to="/dashboard"
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-none transition-colors shadow-sm flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{user?.name ? user.name.split(' ')[0] : 'Akun'}</span>
                <span className="sm:hidden">Dashboard</span>
              </Link>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  to="/login"
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-none transition-colors shadow-sm flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk</span>
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-block border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold px-2.5 py-2 rounded-none transition-colors"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. SUB-BANNER / INFO STATUS PENGANTARAN (ala Lokasi Pengantaran Gojek) */}
      <div className="bg-green-700 dark:bg-green-950 text-white px-3 py-2 text-xs border-b border-green-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <Link
            to={token ? "/dashboard/profile" : "/login"}
            className="flex items-center gap-2 overflow-hidden truncate hover:opacity-90 transition-opacity"
          >
            <span className="px-1.5 py-0.5 bg-green-800 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-green-300" />
              Antar ke
            </span>
            <span className="truncate text-green-100 font-medium">
              {user?.santri_room
                ? `Kamar ${user.santri_room} • ${user.santri_name || user.name}`
                : 'Pilih Kamar / Asrama Santri Al-Mannan'}
            </span>
          </Link>
          <Link
            to={token ? "/dashboard/profile" : "/login"}
            className="text-[11px] underline font-bold shrink-0 text-white hover:text-green-200"
          >
            {token ? 'Ubah' : 'Masuk'}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3.5 space-y-3.5">
        {/* 3. SEARCH INPUT (Flat Sharp & High Density ala GoFood di Foto 5) */}
        <div className="relative">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2.5 flex items-center gap-2 shadow-xs">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lagi mau jajan apa hari ini di pondok? (Cari menu / kantin...)"
              className="flex-1 bg-transparent text-xs sm:text-sm outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            ) : (
              <UtensilsCrossed className="w-4 h-4 text-green-600 shrink-0" />
            )}
          </div>
        </div>

        {/* 4. PROMO BANNER CAROUSEL */}
        <div className="relative">
          {loadingBanners ? (
            <div className="w-full h-36 sm:h-48 bg-gray-200 dark:bg-gray-800 animate-pulse border border-gray-200 dark:border-gray-800" />
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar space-x-3 pb-1"
            >
              {Array.isArray(banners) && banners.length > 0 ? (
                banners.map((banner) => (
                  <div
                    key={banner.id}
                    className="snap-center shrink-0 w-full sm:w-[85%] lg:w-[70%] h-36 sm:h-48 relative overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-900"
                  >
                    <AppImage
                      src={banner.image_path}
                      alt={banner.title}
                      type="banner"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-end p-3 sm:p-4">
                      <div>
                        <span className="px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">
                          Promo Kantin
                        </span>
                        <h3 className="text-white font-bold text-sm sm:text-base leading-tight drop-shadow-sm">
                          {banner.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="snap-center shrink-0 w-full h-36 sm:h-44 bg-gradient-to-r from-green-800 via-green-700 to-emerald-800 p-4 sm:p-6 text-white flex flex-col justify-center border border-green-900">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4 text-green-300" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-green-200">
                      HiGO Pondok Al-Mannan
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl font-extrabold mb-1">
                    Jajan & Kebutuhan Santri Jadi Lebih Praktis!
                  </h3>
                  <p className="text-xs sm:text-sm text-green-100 max-w-xl">
                    Pilih menu favoritmu dari berbagai kantin pondok. Kurir santri siap mengantar ke kamar asrama.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. SHORTCUT LAYANAN 4 KOLOM (ala Gojek di Foto 4 & 5) */}
        <div className="grid grid-cols-4 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('makanan')}
            className={`flex flex-col items-center justify-center p-2.5 bg-white dark:bg-gray-900 border transition-all cursor-pointer ${
              selectedCategory === 'makanan'
                ? 'border-green-600 shadow-2xs'
                : 'border-gray-200 dark:border-gray-800 hover:border-green-500'
            }`}
          >
            <div className="w-10 h-10 bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center mb-1 text-lg">
              🍜
            </div>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white">Makanan</span>
            <span className="text-[9px] text-green-700 dark:text-green-400 font-semibold font-mono">HiFood</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('minuman')}
            className={`flex flex-col items-center justify-center p-2.5 bg-white dark:bg-gray-900 border transition-all cursor-pointer ${
              selectedCategory === 'minuman'
                ? 'border-green-600 shadow-2xs'
                : 'border-gray-200 dark:border-gray-800 hover:border-green-500'
            }`}
          >
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mb-1 text-lg">
              🥤
            </div>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white">Minuman</span>
            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold font-mono">Segar</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('snack')}
            className={`flex flex-col items-center justify-center p-2.5 bg-white dark:bg-gray-900 border transition-all cursor-pointer ${
              selectedCategory === 'snack'
                ? 'border-green-600 shadow-2xs'
                : 'border-gray-200 dark:border-gray-800 hover:border-green-500'
            }`}
          >
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mb-1 text-lg">
              🍿
            </div>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white">Camilan</span>
            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold font-mono">Snack</span>
          </button>

          <Link
            to="/kantin"
            className="flex flex-col items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-green-500 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 bg-green-50 dark:bg-green-950/50 text-green-600 flex items-center justify-center mb-1 text-lg">
              🏪
            </div>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white">Semua Toko</span>
            <span className="text-[9px] text-green-700 dark:text-green-400 font-semibold font-mono">Kantin</span>
          </Link>
        </div>

        {/* 6. VOUCHER PROMO STRIP (ala Gojek Banner di Foto 4) */}
        <Link
          to="/vouchers"
          className="flex items-center justify-between p-2.5 bg-gradient-to-r from-green-700 via-emerald-600 to-green-800 text-white border border-green-800 shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🎟️</span>
            <div>
              <p className="text-xs font-bold leading-tight">Kupon Diskon Ongkir & Layanan Santri</p>
              <p className="text-[10px] text-green-200 leading-tight">Hemat biaya admin dan potongan harga tiap hari</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold shrink-0 bg-white/20 px-2 py-1">
            <span>Klaim</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* 7. KATEGORI FILTER TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 text-xs">
          {[
            { id: 'semua', label: 'Semua Menu' },
            { id: 'buka', label: 'Kantin Buka' },
            { id: 'makanan', label: 'Makanan Berat' },
            { id: 'minuman', label: 'Minuman Segar' },
            { id: 'snack', label: 'Snack & Camilan' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 shrink-0 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 6. DAFTAR KANTIN / TOKO SANTRI */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-green-600" />
              <h2 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                Daftar Kantin Pondok
              </h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {filteredCanteens.length} Toko
            </span>
          </div>

          {loadingCanteens ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 animate-pulse" />
              ))}
            </div>
          ) : filteredCanteens.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500">Tidak ada kantin yang sesuai pencarian.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredCanteens.map((canteen) => (
                <Link
                  key={canteen.id}
                  to={`/kantin/${canteen.id}`}
                  className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-green-600 transition-colors p-2.5 group relative"
                >
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    <AppImage
                      src={canteen.image}
                      alt={canteen.name}
                      type="store"
                      fallbackIcon={<Store className="w-8 h-8 text-gray-400 dark:text-gray-500 opacity-60" />}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>

                  <div className="ml-2.5 flex-1 flex flex-col justify-between overflow-hidden">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
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
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                        {canteen.description || 'Penyedia jajan & makanan santri Al-Mannan'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
                      <span>{canteen.products?.length || 0} Menu Tersedia</span>
                      <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-0.5">
                        Buka Toko <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 7. PILIHAN MENU JAJANAN TERPOPULER */}
        <div>
          <div className="flex items-center justify-between mb-2 pt-2">
            <div className="flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4 text-green-600" />
              <h2 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                Menu & Jajanan Santri
              </h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {filteredProducts.length} Item
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500">Tidak ada produk menu yang cocok dengan filter saat ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {filteredProducts.slice(0, 16).map((product) => {
                const canteen = product.canteen;
                const canteenCart = canteen ? getCanteenItems(canteen.id) : {};
                const currentInCart = canteenCart[String(product.id)]?.quantity || 0;

                return (
                  <div
                    key={product.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 flex flex-col justify-between hover:border-green-500 dark:hover:border-green-600 transition-colors"
                  >
                    <div>
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden mb-2 relative border border-gray-200 dark:border-gray-700">
                        <AppImage
                          src={product.image}
                          alt={product.name}
                          type="food"
                          fallbackIcon={<UtensilsCrossed className="w-8 h-8 text-gray-400 dark:text-gray-500 opacity-40" />}
                          className="w-full h-full object-cover"
                        />
                        {currentInCart > 0 && (
                          <span className="absolute top-1 right-1 bg-green-600 text-white font-mono text-[10px] font-black px-1.5 py-0.5 border border-white dark:border-gray-900">
                            {currentInCart}x di Keranjang
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1 mb-0.5">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mb-1.5 flex items-center gap-1">
                        <Store className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{canteen?.name || 'Kantin'}</span>
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-bold text-green-700 dark:text-green-400">
                        Rp {parseFloat(product.price).toLocaleString('id-ID')}
                      </span>

                      {hasVariants(product) ? (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(canteen, product)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-[10px] font-bold uppercase tracking-wider rounded-none flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-yellow-300" />
                          <span>{currentInCart > 0 ? `+ Opsi (${currentInCart})` : 'Pilih Opsi'}</span>
                        </button>
                      ) : currentInCart > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => removeItem(canteen.id, product.id)}
                            className="w-6 h-6 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 text-gray-700 dark:text-gray-200 hover:text-red-600 flex items-center justify-center border border-gray-200 dark:border-gray-700 text-xs font-bold cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono font-bold px-1">{currentInCart}</span>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(canteen, product)}
                            className="w-6 h-6 bg-green-600 text-white hover:bg-green-700 flex items-center justify-center border border-green-700 text-xs font-bold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(canteen, product)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-[10px] font-bold uppercase tracking-wider rounded-none flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Pesan</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 8. FOOTER / DOKUMENTASI PONDOK */}
        <div className="pt-6 pb-4 border-t border-gray-200 dark:border-gray-800 text-center space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <Link to="/buku-panduan" className="hover:text-green-600 flex items-center gap-1 underline font-semibold">
              <BookOpen className="w-3.5 h-3.5" /> Panduan Pemesanan Santri
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-green-600 font-semibold underline">
              Masuk Akun Santri / Wali
            </Link>
            {!isStandalone && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={installApp}
                  className="hover:text-green-600 font-semibold underline"
                >
                  Pasang Aplikasi di HP
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
            HiGO Pondok Pesantren Al-Mannan © {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* 9. FLOATING ACTIVE CART BANNER */}
      <ActiveCartFloatingBanner />

      {/* 10. MOBILE BOTTOM NAVIGATION (Gojek 4-Tabs ala Foto 4) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 h-14 flex items-center justify-around px-2">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-green-600 dark:text-green-400 text-[10px] font-bold"
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span>Beranda</span>
        </Link>

        <Link
          to="/vouchers"
          className="flex flex-col items-center justify-center text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 text-[10px] font-medium relative"
        >
          <div className="relative">
            <Ticket className="w-5 h-5 mb-0.5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-gray-900"></span>
          </div>
          <span>Promo</span>
        </Link>

        <Link
          to={token ? "/dashboard/pembayaran" : "/login"}
          className="flex flex-col items-center justify-center text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 text-[10px] font-medium"
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span>Aktivitas</span>
        </Link>

        {token ? (
          <Link
            to="/dashboard/profile"
            className="flex flex-col items-center justify-center text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 text-[10px] font-medium"
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>Profil</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center justify-center text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 text-[10px] font-medium"
          >
            <LogIn className="w-5 h-5 mb-0.5" />
            <span>Masuk</span>
          </Link>
        )}
      </nav>

      {/* Product Option Modal (Varian Dinamis & Preset) */}
      <ProductOptionModal
        isOpen={isOptionModalOpen}
        onClose={() => {
          setIsOptionModalOpen(false);
          setSelectedOptionProduct(null);
          setSelectedOptionCanteen(null);
        }}
        product={selectedOptionProduct}
        onConfirm={handleConfirmVariant}
      />
    </div>
  );
}
