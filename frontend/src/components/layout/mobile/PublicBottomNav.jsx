import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Store, Coffee, Ticket, ShoppingCart, User, LogIn, Bot, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useCartStore } from '../../../store/cartStore';

export default function PublicBottomNav() {
  const token = useAuthStore((state) => state.token);
  const totalCartItems = useCartStore((state) => state.getTotalItems());
  const location = useLocation();
  const path = location.pathname;

  const isHome = path === '/';
  const isKantin = path.startsWith('/kantin');
  const isChatAi = path === '/dashboard/pesan-chat' || path === '/pesan-chat';
  const isPromo = path.startsWith('/vouchers') || path.startsWith('/dashboard/vouchers') || path.startsWith('/promo') || path.startsWith('/dashboard/promo');
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

        {/* 3. Chat Belanja AI (Elevated Floating Sharp Cube) */}
        <Link
          to="/dashboard/pesan-chat"
          className="flex flex-col items-center justify-center w-full relative -mt-3.5 group cursor-pointer select-none"
        >
          {/* Floating Badge Tag "✨ AI" */}
          <div className="absolute -top-1.5 z-10 px-1.5 py-0.2 bg-emerald-400 text-gray-950 text-[8px] font-black uppercase tracking-wider rounded-none shadow-xs border border-white dark:border-gray-900 flex items-center gap-0.5 animate-pulse">
            <Sparkles className="w-2.5 h-2.5 text-gray-950" />
            <span>AI</span>
          </div>

          {/* Raised Elevated Cube (Square Flat Hijau Emerald Mengkilap) */}
          <div className={`w-10 h-10 rounded-none border-2 border-white dark:border-gray-900 flex items-center justify-center text-white transition-all transform group-hover:scale-105 group-active:scale-95 shadow-[0_4px_14px_rgba(16,185,129,0.5)] ${
            isChatAi
              ? 'bg-gradient-to-tr from-green-700 via-green-600 to-emerald-400 ring-2 ring-green-500'
              : 'bg-gradient-to-tr from-green-800 via-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-400'
          }`}>
            <Bot className="h-4.5 w-4.5 text-white animate-pulse" strokeWidth={2.5} />
          </div>

          <span className="text-[9.5px] font-black leading-none tracking-tight text-green-600 dark:text-green-400 mt-1">
            Chat AI
          </span>
        </Link>

        {/* 4. Promo & Voucher */}
        <Link
          to={token ? "/dashboard/vouchers" : "/vouchers"}
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
