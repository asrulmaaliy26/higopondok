import React from 'react';
import { Link } from '@tanstack/react-router';
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
        <div className="mb-6 px-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Menu Utama
          </p>
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
                className="group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200"
                activeProps={{
                  className: "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 font-bold"
                }}
                inactiveProps={{
                  className: "text-gray-700 hover:bg-green-50 hover:text-green-700 dark:text-gray-300 dark:hover:bg-green-900/50 dark:hover:text-green-300"
                }}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span className="flex-1 truncate">
                  {item.name === 'User'
                    ? 'Manajemen User'
                    : item.name === 'Pertokoan'
                    ? 'Manajemen Toko'
                    : item.name === 'Pesanan'
                    ? 'Rekap & Pesanan'
                    : item.name === 'Trans'
                    ? 'Transaksi'
                    : item.name === 'Transport'
                    ? 'Transportasi'
                    : item.name}
                </span>
                {badgeContent && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-black leading-none text-white bg-red-500 rounded-full shadow-xs animate-pulse">
                    {badgeContent}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 space-y-2.5">
        {role === ROLES.ADMIN && (
          <SyncDbButton variant="sidebar" />
        )}
        <ThemeToggle variant="switch" showLabel={true} className="w-full justify-between p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs" />
      </div>
    </aside>
  );
}
