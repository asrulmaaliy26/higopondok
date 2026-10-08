import React from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '../../../store/authStore';
import { allMenus } from '../../../config/menus';
import { getUserRole, ROLES } from '../../../config/roles';

import TopHeader from './TopHeader';
import MobileBottomNav from './MobileBottomNav';
import DesktopSidebar from './DesktopSidebar';
import SyncDatabaseModal from '../../modals/SyncDatabaseModal';

export default function DashboardLayout() {
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const location = useLocation();
  const isNoTopHeaderPage = location.pathname !== '/dashboard';

  const targetRole = getUserRole(user);
  const userRole = targetRole || (originalAdmin ? 'user' : 'admin');
  const sidebarMenus = allMenus.filter(menu => menu.roles.includes(userRole));

  const isKantinDetail = location.pathname.match(/^\/dashboard\/kantin\/\d+$/);
  const isKantinList = location.pathname === '/dashboard/kantin';
  const isProfile = location.pathname === '/dashboard/profile';
  const isPembayaran = location.pathname === '/dashboard/pembayaran';
  const isTokoSaya = location.pathname.startsWith('/dashboard/toko-saya');
  const isPesanan = location.pathname.startsWith('/dashboard/pesanan');
  const isPerkuriran = location.pathname.startsWith('/dashboard/perkuriran') || location.pathname.startsWith('/dashboard/tugas-kurir');
  const isKeranjang = location.pathname === '/dashboard/keranjang';
  const isVouchers = location.pathname.startsWith('/dashboard/vouchers') || location.pathname === '/vouchers';
  
  // All mobile pages in Higo Pondok manage their own high-density container & padding
  const isEdgeToEdgePage = true;
  const hideBottomNav = isKantinDetail || isKeranjang;

  return (
    <div className="flex w-full h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <DesktopSidebar sidebarMenus={sidebarMenus} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden relative">

        {/* Top Header */}
        <TopHeader user={user} isNoTopHeaderPage={isNoTopHeaderPage} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-gray-950">
          <div className="min-h-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {!hideBottomNav && (
          <MobileBottomNav sidebarMenus={sidebarMenus} location={location} />
        )}

        {/* Modal Sinkronisasi Database VPS (Super Admin Only) */}
        {userRole === ROLES.SUPER_ADMIN && <SyncDatabaseModal />}
      </div>
    </div>
  );
}
