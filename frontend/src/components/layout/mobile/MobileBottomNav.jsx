import React from 'react';
import { Link } from '@tanstack/react-router';
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
