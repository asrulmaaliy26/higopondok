import React, { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Clock } from 'lucide-react';
import ThemeToggle from '../../ui/ThemeToggle';
import SyncDbButton from '../../common/SyncDbButton';
import { useActiveOrdersCount } from '../../../hooks/useActiveOrdersCount';
import { useCartStore } from '../../../store/cartStore';
import { useAuthStore } from '../../../store/authStore';
import { getUserRole, ROLES } from '../../../config/roles';

export default function DesktopSidebar({ sidebarMenus }) {
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const role = getUserRole(user) || (originalAdmin ? 'user' : 'admin');
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const totalCartItems = role === ROLES.USER ? getTotalItems() : 0;
  const activeOrdersCount = useActiveOrdersCount();

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getTimezoneAbbr = () => {
    const offset = -new Date().getTimezoneOffset() / 60;
    if (offset === 7) return 'WIB';
    if (offset === 8) return 'WITA';
    if (offset === 9) return 'WIT';
    return '';
  };

  const tzAbbr = getTimezoneAbbr();

  return (
    <aside className="hidden lg:flex flex-col inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shrink-0">
      <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo-transparent.png" alt="HiGO" className="h-9 w-9 object-contain" />
          <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            Hi<span className="text-green-600">GO</span> <span className="font-semibold text-base text-gray-600 dark:text-gray-300">Pondok</span>
          </span>
        </Link>
      </div>

      <div className="px-4 py-6 overflow-y-auto flex-1">
        <div className="mb-6 px-4 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Menu Utama
          </p>
          <div 
            title={currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-none font-mono text-[11px] font-semibold tracking-wide select-none shadow-xs"
          >
            <Clock className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
            <span>{formatTime(currentTime)}</span>
            {tzAbbr && (
              <span className="text-[9px] text-green-600 dark:text-green-400 font-sans font-bold">{tzAbbr}</span>
            )}
          </div>
        </div>
        <nav className="space-y-1">
          {sidebarMenus.map((item) => {
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
                className="group flex items-center px-4 py-2.5 text-sm font-medium rounded-none transition-all duration-150"
                activeProps={{
                  className: "bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 font-bold border-l-3 border-green-600"
                }}
                inactiveProps={{
                  className: "text-gray-700 hover:bg-green-50 hover:text-green-700 dark:text-gray-300 dark:hover:bg-green-950/40 dark:hover:text-green-300"
                }}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span className="flex-1 truncate">
                  {item.desktopName || item.name}
                </span>
                {badgeContent && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-black leading-none text-white bg-red-500 rounded-none shadow-xs animate-pulse">
                    {badgeContent}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
      {role === ROLES.SUPER_ADMIN && (
          <SyncDbButton variant="sidebar" />
        )}
        <ThemeToggle variant="switch" showLabel={true} className="w-full justify-between p-2 rounded-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs" />
      </div>
    </aside>
  );
}
