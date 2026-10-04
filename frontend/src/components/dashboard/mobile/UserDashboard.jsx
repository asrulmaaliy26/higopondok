import React, { useRef, useEffect } from 'react';
import {
  Search,
  Wallet,
  Store,
  Clock,
  CheckCircle,
  ShoppingBag,
  ChevronRight,
  ArrowRight,
  UtensilsCrossed,
  Bike,
  Sparkles,
  Plus,
  Minus,
  Star,
  MapPin,
  ClipboardList,
  ShoppingCart,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Ticket
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../../lib/axios';
import { useCartStore } from '../../../store/cartStore';
import ThemeToggle from '../../ui/ThemeToggle';
import AppImage from '../../common/AppImage';

export default function UserDashboard({ user }) {
  const navigate = useNavigate();
  const { addItem, removeItem, getCanteenItems, getTotalItems } = useCartStore();
  const totalCartItems = getTotalItems();

  const scrollBannerRef = useRef(null);

  // 1. Fetch Orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['user_orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data || [];
    }
  });

  // 2. Fetch Canteens with products
  const { data: canteens = [], isLoading: loadingCanteens } = useQuery({
    queryKey: ['canteens'],
    queryFn: async () => {
      const res = await api.get('/canteens');
      return res.data.data || res.data || [];
    }
  });

  // 3. Fetch Banners
  const { data: banners = [], isLoading: loadingBanners } = useQuery({
    queryKey: ['canteen-banners'],
    queryFn: async () => {
      const res = await api.get('/banners');
      return res.data || [];
    }
  });

  // Auto scroll banners
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      if (scrollBannerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollBannerRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollBannerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollBannerRef.current.scrollBy({ left: clientWidth, behavior: 'smooth' });
        }
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [banners]);

  // Active orders (pesanan aktif yang sedang diproses / diantar)
  const activeOrders = Array.isArray(orders)
    ? orders.filter((o) => ['pending', 'processing'].includes(o.status))
    : [];

  const completedOrders = Array.isArray(orders)
    ? orders.filter((o) => o.status === 'completed')
    : [];

  // Flatten popular products
  const popularProducts = React.useMemo(() => {
    if (!Array.isArray(canteens)) return [];
    const list = [];
    canteens.forEach((c) => {
      if (Array.isArray(c.products)) {
        c.products.forEach((prod) => {
          list.push({ ...prod, canteen: c });
        });
      }
    });
    return list;
  }, [canteens]);

  const handleAddToCart = (canteen, product) => {
    addItem(canteen, product);
    toast.success(`${product.name} dimasukkan ke keranjang`, {
      duration: 1800,
      position: 'bottom-center'
    });
  };

  return (
    <div className="space-y-3 font-sans pb-16">
      {/* 1. TOP SEARCH & GREETING BAR (Gojek Header Style) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-green-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="truncate">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-none">
                Ahlan wa Sahlan,
              </p>
              <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                {user?.santri_name || user?.name || 'Santri Al-Mannan'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-[10px] font-bold text-green-800 dark:text-green-300">
              <MapPin className="w-3 h-3 text-green-600 shrink-0" />
              <span className="truncate max-w-[120px]">{user?.santri_room || 'Kamar Santri'}</span>
            </div>
            <ThemeToggle size="sm" />
          </div>
        </div>

        {/* Gojek Style Search Bar */}
        <Link
          to="/dashboard/kantin"
          className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <Search className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
            Lagi mau jajan apa hari ini di pondok?
          </span>
        </Link>
      </div>

      {/* 2. GOJEK WALLET BAR (Gopay / E-Money Santri Style) */}
      <div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-700 text-white border border-green-800 shadow-sm p-3">
        <div className="flex items-center justify-between gap-3">
          {/* Sisi Kiri: Info Saldo & Asrama */}
          <div className="flex-1 border-r border-green-600/60 pr-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Wallet className="w-3.5 h-3.5 text-green-200" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-100">
                HiPay Santri
              </span>
            </div>
            <p className="text-sm sm:text-base font-extrabold font-mono leading-tight">
              {user?.balance ? `Rp ${parseFloat(user.balance).toLocaleString('id-ID')}` : 'Limit Terpantau'}
            </p>
            <p className="text-[10px] text-green-100/90 truncate mt-0.5">
              {user?.santri_class ? `Kelas: ${user.santri_class}` : 'Akun Terhubung Wali'}
            </p>
          </div>

          {/* Sisi Kanan: Tombol Aksi Cepat Vertikal ala GoPay */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/dashboard/kantin"
              className="flex flex-col items-center justify-center p-1.5 text-white hover:text-green-200 transition-colors"
            >
              <div className="w-8 h-8 bg-white/20 border border-white/30 flex items-center justify-center mb-1">
                <Store className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold">Jajan</span>
            </Link>

            <Link
              to="/dashboard/pembayaran"
              className="flex flex-col items-center justify-center p-1.5 text-white hover:text-green-200 transition-colors"
            >
              <div className="w-8 h-8 bg-white/20 border border-white/30 flex items-center justify-center mb-1">
                <ClipboardList className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold">Riwayat</span>
            </Link>

            <Link
              to="/dashboard/vouchers"
              className="flex flex-col items-center justify-center p-1.5 text-white hover:text-green-200 transition-colors"
            >
              <div className="w-8 h-8 bg-white/20 border border-white/30 flex items-center justify-center mb-1">
                <Ticket className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold">Voucher</span>
            </Link>

            <Link
              to="/dashboard/keranjang"
              className="flex flex-col items-center justify-center p-1.5 text-white hover:text-green-200 transition-colors relative"
            >
              <div className="w-8 h-8 bg-white/20 border border-white/30 flex items-center justify-center mb-1 relative">
                <ShoppingCart className="w-4 h-4" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-mono text-[9px] font-black w-4 h-4 flex items-center justify-center border border-green-800 leading-none">
                    {totalCartItems > 99 ? '99+' : totalCartItems}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">Keranjang</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3. PESANAN AKTIF BERJALAN (Gojek Floating Active Order Tracker) */}
      {activeOrders.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-800/80 p-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Bike className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase px-1 py-0.2 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 tracking-wider">
                    {activeOrders[0].status === 'pending' ? 'Menunggu Konfirmasi' : 'Sedang Diproses Kurir'}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {activeOrders[0].canteen?.name || 'Kantin Pondok'} • Rp{' '}
                  {parseFloat(activeOrders[0].total_price).toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  Tujuan: {activeOrders[0].delivery_location || user?.santri_room || 'Kamar Santri'}
                </p>
              </div>
            </div>

            <Link
              to="/dashboard/pembayaran"
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors"
            >
              <span>Pantau</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* 4. GOJEK 4-GRID SERVICES (Layanan Utama ala Gojek) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
          Layanan Santri Al-Mannan
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Link
            to="/dashboard/kantin"
            className="flex flex-col items-center group"
          >
            <div className="w-12 h-12 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center text-green-700 dark:text-green-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">HiFood</span>
            <span className="text-[9px] text-gray-400 leading-none">Kantin</span>
          </Link>

          <Link
            to="/dashboard/kantin"
            className="flex flex-col items-center group"
          >
            <div className="w-12 h-12 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center text-green-700 dark:text-green-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
              <Bike className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">HiSend</span>
            <span className="text-[9px] text-gray-400 leading-none">Antar Kamar</span>
          </Link>

          <Link
            to="/dashboard/kantin"
            className="flex flex-col items-center group"
          >
            <div className="w-12 h-12 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center text-green-700 dark:text-green-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">HiMart</span>
            <span className="text-[9px] text-gray-400 leading-none">Snack</span>
          </Link>

          <Link
            to="/dashboard/pembayaran"
            className="flex flex-col items-center group"
          >
            <div className="w-12 h-12 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center text-green-700 dark:text-green-400 group-hover:scale-105 transition-transform mb-1 shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">Pesanan</span>
            <span className="text-[9px] text-gray-400 leading-none">Status</span>
          </Link>
        </div>
      </div>

      {/* 5. PROMO BANNER (Gojek Banner Carousel) */}
      <div className="relative">
        {loadingBanners ? (
          <div className="w-full h-28 bg-gray-200 dark:bg-gray-800 animate-pulse border border-gray-200 dark:border-gray-800" />
        ) : (
          <div
            ref={scrollBannerRef}
            className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar space-x-2.5 pb-1"
          >
            {Array.isArray(banners) && banners.length > 0 ? (
              banners.map((b) => (
                <div
                  key={b.id}
                  className="snap-center shrink-0 w-full sm:w-[85%] h-28 sm:h-36 relative overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-900"
                >
                  <img src={getStorageUrl(b.image_path)} alt={b.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                    <p className="text-white font-bold text-xs sm:text-sm drop-shadow-sm line-clamp-1">{b.title}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="snap-center shrink-0 w-full h-24 bg-gradient-to-r from-green-800 to-emerald-800 text-white p-3 flex items-center justify-between border border-green-900">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-1 py-0.5">
                    HiGO Promo
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold mt-1">Gratis Biaya Layanan Pesantren</h4>
                  <p className="text-[10px] text-green-100">Pesan makanan favorit langsung diantar ke kamar santri</p>
                </div>
                <Store className="w-8 h-8 text-green-300 opacity-80 shrink-0" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. PALING LARIS DI PONDOK (Horizontal Scroll ala GoFood) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
              Paling Laris di Pondok
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Jajanan favorit para santri Al-Mannan</p>
          </div>
          <Link
            to="/dashboard/kantin"
            className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5 hover:underline"
          >
            Lihat Semua <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar space-x-2.5 pb-1">
          {popularProducts.slice(0, 8).map((product) => {
            const canteen = product.canteen;
            const canteenCart = canteen ? getCanteenItems(canteen.id) : {};
            const currentQty = canteenCart[String(product.id)]?.quantity || 0;

            return (
              <div
                key={product.id}
                className="shrink-0 w-36 sm:w-40 border border-gray-200 dark:border-gray-800 p-2 flex flex-col justify-between hover:border-green-500 transition-colors"
              >
                <div>
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden mb-1.5 relative border border-gray-100 dark:border-gray-700">
                    <AppImage
                      src={product.image}
                      alt={product.name}
                      type="food"
                      fallbackIcon={<UtensilsCrossed className="w-6 h-6 text-gray-400 dark:text-gray-500 opacity-40" />}
                      className="w-full h-full object-cover"
                    />
                    {currentQty > 0 && (
                      <span className="absolute top-1 right-1 bg-green-600 text-white font-mono text-[9px] font-black px-1 py-0.2">
                        {currentQty}x
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">{product.name}</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                    <Store className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                    <span>{canteen?.name || 'Kantin'}</span>
                  </p>
                </div>

                <div className="pt-1.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between mt-1">
                  <span className="text-xs font-mono font-bold text-green-700 dark:text-green-400">
                    Rp {parseFloat(product.price).toLocaleString('id-ID')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(canteen, product)}
                    className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white font-bold text-xs flex items-center justify-center transition-colors active:scale-90"
                    title="Tambah"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. KANTIN & WARUNG PILIHAN (Daftar Resto ala GoFood) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
              Kantin & Toko Pilihan
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Pesan langsung dari stan terdekat</p>
          </div>
          <Link
            to="/dashboard/kantin"
            className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5 hover:underline"
          >
            Lihat Semua <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2">
          {canteens.slice(0, 4).map((canteen) => (
            <Link
              key={canteen.id}
              to={`/kantin/${canteen.id}`}
              className="flex bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-green-600 p-2 transition-colors group"
            >
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0 flex items-center justify-center">
                <AppImage
                  src={canteen.image}
                  alt={canteen.name}
                  type="store"
                  fallbackIcon={<Store className="w-6 h-6 text-gray-400 dark:text-gray-500 opacity-60" />}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="ml-2.5 flex-1 flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                      {canteen.name}
                    </h4>
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 uppercase tracking-wider shrink-0 ${
                        canteen.is_open
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}
                    >
                      {canteen.is_open ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                    {canteen.description || 'Kantin resmi pondok pesantren'}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="flex items-center gap-1">
                    <Bike className="w-3 h-3 text-green-600" /> Antar ke Kamar
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-bold">Buka Menu →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 8. PESANAN TERAKHIR (Gojek Recent Orders / Pesan Lagi) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
            Pesanan Terakhir
          </h3>
          <Link
            to="/dashboard/pembayaran"
            className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5 hover:underline"
          >
            Riwayat <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="py-5 text-center text-gray-400 text-xs">Belum ada riwayat pesanan santri.</div>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 3).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-xs"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{o.canteen?.name || 'Kantin'}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} •{' '}
                      {o.items?.length || 0} Menu
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-gray-900 dark:text-white">
                    Rp {parseFloat(o.total_price).toLocaleString('id-ID')}
                  </p>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.2 inline-block ${
                      o.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {o.status === 'completed' ? 'Selesai' : o.status === 'pending' ? 'Menunggu' : 'Diproses'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
