import React, { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, UtensilsCrossed, Store, ChevronLeft, ShoppingCart, Clock, Sparkles } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import ActiveCartFloatingBanner from '../../components/cart/ActiveCartFloatingBanner';
import AppImage from '../../components/common/AppImage';

export default function Kantin() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const totalCartItems = getTotalItems();

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Banners (Approved)
  const { data: banners, isLoading: loadingBanners } = useQuery({
    queryKey: ['canteen-banners'],
    queryFn: async () => {
      const res = await axios.get('/banners');
      return res.data || [];
    }
  });

  // Fetch Canteens
  const { data: canteens, isLoading: loadingCanteens } = useQuery({
    queryKey: ['canteens'],
    queryFn: async () => {
      const res = await axios.get('/canteens');
      return res.data.data || res.data || [];
    }
  });

  const scrollContainerRef = useRef(null);

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

  const filteredCanteens = Array.isArray(canteens)
    ? canteens.filter(
        (c) =>
          !searchQuery ||
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="pb-28 bg-slate-50 dark:bg-gray-950 min-h-screen font-sans">
      {/* HEADER SECTION (Flat & Sharp with Sleek Gojek Gradient) */}
      <div className="bg-gradient-to-b from-green-800 via-green-700 to-green-800 dark:from-green-950 dark:via-emerald-950 dark:to-gray-950 pt-3 pb-7 px-3 sm:px-4 border-b border-green-800/80 shadow-inner">
        <div className="max-w-5xl mx-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: '/' }))}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-none border border-white/20 backdrop-blur-xs transition-all shadow-xs"
                title="Kembali"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-none drop-shadow-xs">
                  Kantin & Toko Pondok
                </h1>
                <p className="text-[10px] text-green-200 font-medium mt-0.5">Pesantren Al-Mannan</p>
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
                to="/dashboard/keranjang"
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

          {/* Banner Carousel */}
          {loadingBanners ? (
            <div className="w-full h-32 sm:h-40 bg-green-900/40 border border-green-800/80 animate-pulse"></div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar space-x-3 pb-1"
            >
              {Array.isArray(banners) && banners.length > 0 ? (
                banners.map((banner) => (
                  <div
                    key={banner.id}
                    className="snap-center shrink-0 w-full sm:w-[85%] h-32 sm:h-40 overflow-hidden relative border border-green-700/60 bg-gray-900 shadow-md"
                  >
                    <AppImage
                      src={banner.image_path}
                      alt={banner.title}
                      type="banner"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex items-end p-3.5">
                      <div>
                        <span className="px-1.5 py-0.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[9px] font-extrabold uppercase tracking-wider mb-1 inline-block border border-emerald-400/40">
                          Promo Kantin
                        </span>
                        <h3 className="text-white font-bold text-xs sm:text-sm drop-shadow-sm leading-tight">
                          {banner.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="snap-center shrink-0 w-full h-32 sm:h-36 relative overflow-hidden bg-gradient-to-r from-emerald-900 via-green-800 to-teal-900 border border-emerald-600/40 p-4 sm:p-5 flex items-center justify-between text-white shadow-lg">
                  {/* Decorative glowing gradient orbs */}
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute right-12 -bottom-10 w-28 h-28 bg-green-400/15 rounded-full blur-xl pointer-events-none" />

                  <div className="relative z-10 max-w-[78%]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="px-1.5 py-0.2 bg-white/20 backdrop-blur-xs text-[9px] font-black uppercase tracking-wider text-emerald-200 border border-white/25">
                        HiGO Food
                      </span>
                      <span className="text-[10px] text-emerald-200 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-yellow-300" />
                        Layanan Jastip Santri
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight drop-shadow-xs mb-1">
                      Selamat Datang di Kantin Al-Mannan
                    </h3>
                    <p className="text-[11px] text-emerald-100/90 leading-snug line-clamp-2">
                      Pesan jajanan, makanan, & minuman favorit santri. Kurir pondok siap antar langsung ke kamar!
                    </p>
                  </div>

                  <div className="relative z-10 shrink-0 w-12 h-12 bg-white/10 backdrop-blur-xs border border-white/25 flex items-center justify-center shadow-inner">
                    <Store className="w-6 h-6 text-emerald-200" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 -mt-3 relative z-20 space-y-3">
        {/* SEARCH BAR (Flat & Sharp) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 flex items-center gap-2 shadow-xs">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama kantin atau menu makanan..."
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

        {/* LIST KANTIN */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
              Kantin & Warung Tersedia
            </h2>
            <span className="text-[11px] text-gray-500 font-mono">{filteredCanteens.length} Toko</span>
          </div>

          {loadingCanteens ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full h-20 bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 animate-pulse"></div>
              ))}
            </div>
          ) : filteredCanteens.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500">Tidak ada kantin yang cocok dengan kata kunci "{searchQuery}".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCanteens.map((canteen) => (
                <Link
                  key={canteen.id}
                  to={`/kantin/${canteen.id}`}
                  className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-green-600 dark:hover:border-green-600 p-2.5 transition-colors group"
                >
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                    <AppImage
                      src={canteen.image}
                      alt={canteen.name}
                      type="store"
                      fallbackIcon={<Store size={28} className="text-gray-400 dark:text-gray-500" />}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="ml-3 flex-1 flex flex-col justify-between overflow-hidden">
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
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mb-1">
                        {canteen.description || 'Menyediakan makanan, minuman, dan jajan santri'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
                      <span>{canteen.products?.length || 0} Menu</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">Pilih Menu →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <ActiveCartFloatingBanner />
    </div>
  );
}
