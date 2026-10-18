import React from 'react';
import { Link } from '@tanstack/react-router';
import { Sparkles, Bot } from 'lucide-react';
import { useActiveOrdersCount } from '../../../hooks/useActiveOrdersCount';
import { useCartStore } from '../../../store/cartStore';
import { useAuthStore } from '../../../store/authStore';
import { getUserRole, ROLES } from '../../../config/roles';

export default function MobileBottomNav({ sidebarMenus, location }) {
  if (location.pathname === '/dashboard/profile') return null;

  const user = useAuthStore(state => state.user);
  const originalAdmin = useAuthStore(state => state.originalAdmin);
  const role = getUserRole(user) || (originalAdmin ? 'user' : 'admin');
  const getTotalItems = useCartStore(state => state.getTotalItems);
  const totalCartItems = role === ROLES.USER ? getTotalItems() : 0;
  const activeOrdersCount = useActiveOrdersCount();

  const navItems = sidebarMenus.filter(item => item.showOnMobile !== false);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map((item) => {
          const isKeranjang = item.href === '/dashboard/keranjang';
          const isChatAi = item.href === '/dashboard/pesan-chat';
          const isPesanan = 
            item.href === '/dashboard/toko-saya/pesanan' || 
            item.href === '/dashboard/admin/pesanan' || 
            item.href === '/dashboard/tugas-kurir' || 
            item.href === '/dashboard/pembayaran';
          
          let badgeContent = null;
          if (isKeranjang && totalCartItems > 0) {
            badgeContent = totalCartItems > 99 ? '99+' : totalCartItems;
          } else if (isPesanan && activeOrdersCount > 0) {
            badgeContent = activeOrdersCount > 99 ? '99+' : activeOrdersCount;
          }

          // Tampilan Khusus Menonjol untuk Chat AI (Elevated Floating Sharp Cube)
          if (isChatAi) {
            const isCurrentlyActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                activeOptions={{ exact: true }}
                className="flex flex-col items-center justify-center w-full relative -mt-4 group cursor-pointer select-none"
              >
                {/* Floating Badge Tag "✨ AI" */}
                <div className="absolute -top-1.5 z-10 px-1.5 py-0.2 bg-emerald-400 text-gray-950 text-[8px] font-black uppercase tracking-wider rounded-none shadow-xs border border-white dark:border-gray-900 flex items-center gap-0.5 animate-pulse">
                  <Sparkles className="w-2.5 h-2.5 text-gray-950" />
                  <span>AI</span>
                </div>

                {/* Raised Elevated Cube (Square Flat Hijau Emerald Mengkilap) */}
                <div className={`w-11 h-11 rounded-none border-2 border-white dark:border-gray-900 flex items-center justify-center text-white transition-all transform group-hover:scale-105 group-active:scale-95 shadow-[0_4px_16px_rgba(16,185,129,0.5)] ${
                  isCurrentlyActive
                    ? 'bg-gradient-to-tr from-green-700 via-green-600 to-emerald-400 ring-2 ring-green-500'
                    : 'bg-gradient-to-tr from-green-800 via-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-400'
                }`}>
                  <Bot className="h-5 w-5 text-white animate-pulse" strokeWidth={2.5} />
                </div>

                <span className="text-[10px] font-black leading-none tracking-tight text-green-600 dark:text-green-400 mt-1">
                  Chat AI
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              activeOptions={{ exact: true }}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative"
              activeProps={{
                className: "text-green-600 dark:text-green-400 font-bold"
              }}
              inactiveProps={{
                className: "text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400"
              }}
            >
              <div className="relative">
                <item.icon className="h-5 w-5 mb-0.5" strokeWidth={2} />
                {badgeContent && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-black min-w-[16px] h-3.5 flex items-center justify-center rounded-none px-1 border border-white dark:border-gray-900 leading-none shadow-xs animate-pulse">
                    {badgeContent}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none tracking-tight">{item.mobileName || item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
