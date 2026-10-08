import React from 'react';
import { Link } from '@tanstack/react-router';
import { getUserRole, getRoleLabel, ROLES, isAdminLevel } from '../../../config/roles';
import ThemeToggle from '../../ui/ThemeToggle';
import SyncDbButton from '../../common/SyncDbButton';

export default function TopHeader({ user, isNoTopHeaderPage }) {
  if (isNoTopHeaderPage) return null;

  const role = getUserRole(user);
  const roleLabel = getRoleLabel(role);

  // Warna avatar berdasarkan role
  const avatarColor = role === ROLES.SUPER_ADMIN
    ? 'bg-amber-500 border-amber-600'
    : role === ROLES.ADMIN
    ? 'bg-green-600 border-green-700'
    : role === ROLES.KANTIN
    ? 'bg-purple-600 border-purple-700'
    : role === ROLES.KURIR
    ? 'bg-gray-600 border-gray-700'
    : 'bg-green-600 border-green-700';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between lg:justify-end border-b border-gray-200 bg-white/95 backdrop-blur-md dark:bg-gray-900/95 dark:border-gray-800 px-3 sm:px-6 lg:px-8 shadow-xs">
      {/* Mobile App Title (Visible only on mobile header) */}
      <div className="lg:hidden flex items-center gap-2">
        <img src="/logo-transparent.png" alt="HiGO" className="h-7 w-7 object-contain" />
        <h1 className="text-base font-black text-gray-900 dark:text-white tracking-tight">
          Hi<span className="text-green-600">GO</span> <span className="font-semibold text-xs text-gray-600 dark:text-gray-300">Pondok</span>
        </h1>
      </div>
      
      <div className="flex items-center gap-2">

        {/* Tombol Sinkronisasi / Backup Database VPS */}
        <SyncDbButton variant="header" />

        {/* Theme Mode Toggle */}
        <ThemeToggle size="sm" />

        <button className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-none cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-none bg-red-500 ring-1 ring-white dark:ring-gray-900" />
        </button>
        
        <div className="relative flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <Link 
            to="/dashboard/profile"
            className="flex items-center gap-2 text-left focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-800/60 p-1 rounded-none transition-colors"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{roleLabel}</p>
            </div>
            <div className={`h-8 w-8 rounded-none flex items-center justify-center text-white font-bold text-xs shrink-0 border ${avatarColor}`}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'K'}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
