import React from 'react';
import { CloudDownload, Download, RefreshCw, Database } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { useSyncStatus } from '../../hooks/useDatabaseSync';
import { ROLES, getUserRole } from '../../config/roles';

export default function SyncDbButton({ variant = 'header', className = '' }) {
  const user = useAuthStore((state) => state.user);
  const openModal = useSyncStore((state) => state.openModal);
  const { data: statusData, isLoading } = useSyncStatus(user);

  const role = getUserRole(user);
  if (role !== ROLES.ADMIN) {
    return null;
  }

  // Jika statusData belum termuat, default adalah is_local = true (karena sedang di local environment)
  const isLocal = statusData ? statusData.is_local : true;
  const exportUrl = statusData?.export_url || '#';

  // Variant Header (Kecil, pil rounded, cocok di samping ThemeToggle)
  if (variant === 'header') {
    if (isLocal) {
      return (
        <button
          type="button"
          onClick={openModal}
          title="Tarik & Sinkronkan Database dari VPS (Data Live)"
          className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 dark:from-amber-600 dark:to-amber-700 rounded-full shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer shrink-0 ${className}`}
        >
          <CloudDownload className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Tarik DB VPS</span>
          <span className="sm:hidden text-[11px]">Tarik DB</span>
        </button>
      );
    }

    return (
      <a
        href={exportUrl}
        title="Unduh Cadangan Database VPS (.sql.gz)"
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-full shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer shrink-0 ${className}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Backup DB</span>
        <span className="sm:hidden text-[11px]">Backup</span>
      </a>
    );
  }

  // Variant Sidebar (Full width item di footer sidebar)
  if (variant === 'sidebar') {
    if (isLocal) {
      return (
        <button
          type="button"
          onClick={openModal}
          title="Tarik & Sinkronkan Database dari VPS"
          className={`w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200/70 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
              <CloudDownload className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block leading-tight">Tarik DB VPS</span>
              <span className="text-[10px] font-normal text-amber-700/80 dark:text-amber-300/80">Sinkron Data Live</span>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100 font-mono">
            1-Klik
          </span>
        </button>
      );
    }

    return (
      <a
        href={exportUrl}
        title="Unduh Cadangan Database VPS (.sql.gz)"
        className={`w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${className}`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
            <Download className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="block leading-tight">Backup Database</span>
            <span className="text-[10px] font-normal text-emerald-700/80 dark:text-emerald-300/80">Unduh .sql.gz</span>
          </div>
        </div>
      </a>
    );
  }

  // Variant Card (Akses Cepat di Admin Dashboard)
  return (
    <button
      type="button"
      onClick={isLocal ? openModal : undefined}
      onClickCapture={!isLocal ? () => window.location.href = exportUrl : undefined}
      className={`flex flex-col items-center text-center justify-center p-2 rounded-none bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 transition-all border border-amber-200/70 dark:border-amber-800/60 shadow-2xs cursor-pointer ${className}`}
    >
      <CloudDownload className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-1" />
      <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
        {isLocal ? 'Tarik DB VPS' : 'Backup DB'}
      </span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block leading-none mt-0.5">
        {isLocal ? 'Sinkron Data Live' : 'Unduh Dump DB'}
      </span>
    </button>
  );
}
