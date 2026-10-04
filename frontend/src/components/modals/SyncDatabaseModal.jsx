import React from 'react';
import { 
  CloudDownload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Server, 
  Database,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';
import { useSyncStatus, usePullDatabase } from '../../hooks/useDatabaseSync';

export default function SyncDatabaseModal() {
  const { isOpen, closeModal } = useSyncStore();
  const user = useAuthStore((state) => state.user);
  const { data: statusData } = useSyncStatus(user);
  const pullMutation = usePullDatabase();

  if (!isOpen) return null;

  const handleStartPull = () => {
    pullMutation.mutate();
  };

  const handleReload = () => {
    closeModal();
    window.location.reload();
  };

  const isPending = pullMutation.isPending;
  const isSuccess = pullMutation.isSuccess;
  const isError = pullMutation.isError;
  const resultData = pullMutation.data;
  const errorObj = pullMutation.error;

  const vpsUrl = statusData?.vps_url || 'https://higo.lpialhidayah.or.id/api/db-sync/export';
  const dbName = statusData?.database || 'staialmannan_higo';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-none shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="relative p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-none bg-emerald-600 text-white shadow-xs">
                <CloudDownload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Tarik Database dari VPS
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Sinkronisasi database lokal dengan data live
                </p>
              </div>
            </div>
            {!isPending && (
              <button
                type="button"
                onClick={closeModal}
                className="w-7 h-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-none border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Modal */}
        <div className="p-3.5 sm:p-4 space-y-3">
          {/* State 1: Konfirmasi Awal */}
          {!isPending && !isSuccess && !isError && (
            <>
              {/* Info Target */}
              <div className="rounded-none p-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]">
                    <Server className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Target VPS:
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono text-[11px] truncate max-w-[200px]">
                    {vpsUrl.replace('/api/db-sync/export', '')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]">
                    <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Database Lokal:
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
                    {dbName}
                  </span>
                </div>
              </div>

              {/* Deskripsi & Peringatan */}
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Seluruh data di database lokal Anda akan disinkronkan dan ditimpa dengan <b>data live terkini dari VPS</b>.
                </p>

                <div className="flex items-start gap-2 p-2 rounded-none bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px]">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Catatan Penting:</span>
                    Memerlukan koneksi internet stabil. Proses pengunduhan dan impor dump SQL memerlukan waktu sekitar 3–15 detik.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* State 2: Sedang Menyinkronkan (Loading) */}
          {isPending && (
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600 animate-spin flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-emerald-600 animate-pulse" />
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Sedang Menyinkronkan...
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Menghubungi VPS, mengunduh database terkini, dan mengimpor seluruh tabel ke lokal.
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Mohon tunggu dan jangan menutup halaman ini.
                </p>
              </div>
            </div>
          )}

          {/* State 3: Sukses */}
          {isSuccess && (
            <div className="py-3 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-none bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Sinkronisasi Berhasil!
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {resultData?.message || 'Database lokal telah berhasil diperbarui sesuai data VPS terbaru.'}
                </p>
              </div>

              {resultData?.details && (
                <div className="w-full p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-[11px] text-left space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Total Query:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {resultData.details.queries_executed} / {resultData.details.total_queries}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Waktu Selesai:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {resultData.details.timestamp}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* State 4: Error */}
          {isError && (
            <div className="py-3 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-none bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-300 dark:border-red-800">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Gagal Menyinkronkan Database
                </h4>
                <p className="text-xs text-red-600 dark:text-red-400 max-w-sm">
                  {errorObj?.response?.data?.error || errorObj?.message || 'Terjadi kesalahan saat menarik database dari VPS.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-end gap-2">
          {/* Normal State Buttons */}
          {!isPending && !isSuccess && !isError && (
            <>
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleStartPull}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-none shadow-xs transition-all cursor-pointer"
              >
                <CloudDownload className="w-3.5 h-3.5" />
                Ya, Tarik Data Sekarang
              </button>
            </>
          )}

          {/* Success State Buttons */}
          {isSuccess && (
            <button
              type="button"
              onClick={handleReload}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-none shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Segarkan Halaman
            </button>
          )}

          {/* Error State Buttons */}
          {isError && (
            <>
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleStartPull}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-none shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
