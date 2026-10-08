import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Store, Coffee, Ticket, ShoppingCart, User, LogIn } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useCartStore } from '../../../store/cartStore';

export default function PublicBottomNav() {
  const token = useAuthStore((state) => state.token);
  const totalCartItems = useCartStore((state) => state.getTotalItems());
  const location = useLocation();
  const path = location.pathname;

  const isHome = path === '/';
  const isKantin = path.startsWith('/kantin');
  const isKeranjang = path === '/keranjang' || path === '/dashboard/keranjang';
  const isPromo = path.startsWith('/vouchers');
  const isProfile = path.startsWith('/dashboard/profile') || path === '/profile' || path === '/login';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around items-center h-14 px-1">
        {/* 1. Beranda */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative ${
            isHome
              ? 'text-green-600 dark:text-green-400 font-bold'
              : 'text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 font-medium'
          }`}
        >
          <Store className="h-5 w-5" strokeWidth={isHome ? 2.5 : 2} />
          <span className="text-[10px] leading-none tracking-wide">Beranda</span>
        </Link>

        {/* 2. Kantin (Toko Santri) */}
        <Link
          to="/kantin"
          className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative ${
            isKantin
              ? 'text-green-600 dark:text-green-400 font-bold'
              : 'text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 font-medium'
          }`}
        >
          <Coffee className="h-5 w-5" strokeWidth={isKantin ? 2.5 : 2} />
          <span className="text-[10px] leading-none tracking-wide">Kantin</span>
        </Link>

        {/* 3. Keranjang Belanja (Dengan Badge Jumlah Item) */}
        <Link
          to={token ? "/dashboard/keranjang" : "/keranjang"}
          className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative ${
            isKeranjang
              ? 'text-green-600 dark:text-green-400 font-bold'
              : 'text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 font-medium'
          }`}
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" strokeWidth={isKeranjang ? 2.5 : 2} />
            {totalCartItems > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-red-600 text-white font-mono text-[9px] font-black min-w-[15px] h-3.5 flex items-center justify-center rounded-none px-0.5 border border-white dark:border-gray-900 leading-none shadow-xs">
                {totalCartItems > 99 ? '99+' : totalCartItems}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-none tracking-wide">Keranjang</span>
        </Link>

        {/* 4. Promo & Voucher */}
        <Link
          to="/vouchers"
          className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative ${
            isPromo
              ? 'text-green-600 dark:text-green-400 font-bold'
              : 'text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 font-medium'
          }`}
        >
          <div className="relative">
            <Ticket className="h-5 w-5" strokeWidth={isPromo ? 2.5 : 2} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-gray-900" />
          </div>
          <span className="text-[10px] leading-none tracking-wide">Promo</span>
        </Link>

        {/* 5. Profil / Masuk */}
        {token ? (
          <Link
            to="/dashboard/profile"
            className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative ${
              isProfile
                ? 'text-green-600 dark:text-green-400 font-bold'
                : 'text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 font-medium'
            }`}
          >
            <User className="h-5 w-5" strokeWidth={isProfile ? 2.5 : 2} />
            <span className="text-[10px] leading-none tracking-wide">Profil</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative ${
              isProfile
                ? 'text-green-600 dark:text-green-400 font-bold'
                : 'text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 font-medium'
            }`}
          >
            <LogIn className="h-5 w-5" strokeWidth={isProfile ? 2.5 : 2} />
            <span className="text-[10px] leading-none tracking-wide">Masuk</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
