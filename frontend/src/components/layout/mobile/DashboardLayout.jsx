import React from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '../../../store/authStore';
import { allMenus } from '../../../config/menus';
import { getUserRole } from '../../../config/roles';

import TopHeader from './TopHeader';
import MobileBottomNav from './MobileBottomNav';
import DesktopSidebar from './DesktopSidebar';
import ActiveCartFloatingBanner from '../../cart/ActiveCartFloatingBanner';
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
  
  // Pages that manage their own full-bleed layout
  const isEdgeToEdgePage = isKantinDetail || isKantinList || isProfile || isPembayaran || isTokoSaya || isPesanan || isPerkuriran || isKeranjang;
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
          <div className={`${isEdgeToEdgePage ? 'min-h-full' : 'p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 lg:pb-8 min-h-full'}`}>
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {!hideBottomNav && (
          <MobileBottomNav sidebarMenus={sidebarMenus} location={location} />
        )}

        {/* Floating Active Cart Banner (Muncul saat user keluar dari detail toko & masih ada item di keranjang) */}
        <ActiveCartFloatingBanner />

        {/* Modal Sinkronisasi Database VPS (Admin) */}
        {userRole === 'admin' && <SyncDatabaseModal />}
      </div>
    </div>
  );
}
