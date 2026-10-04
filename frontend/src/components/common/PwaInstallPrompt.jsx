import React from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePwaStore } from '../../store/pwaStore';

export default function PwaInstallPrompt() {
  const {
    isStandalone,
    showBanner,
    showGuideModal,
    isIOS,
    installApp,
    dismissBanner,
    openGuideModal,
    closeGuideModal,
  } = usePwaStore();

  // If already running standalone (installed as app), do not render banner
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Install Banner */}
      {showBanner && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md z-40 animate-fade-in-up">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 shadow-xl shadow-green-900/10 border border-green-500/20 dark:border-green-500/30 flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 flex items-center justify-center flex-shrink-0 shadow-md p-1.5">
              <img
                src="/icon-192x192.png"
                alt="HiGO Pondok"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  Pasang Aplikasi Higo
                </h4>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="p-1 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
                Akses cepat, hemat kuota, dan pengalaman layar penuh di HP Anda.
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={installApp}
                  className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-semibold py-2 px-3 rounded-xl shadow-sm shadow-green-600/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isIOS ? 'Cara Pasang' : 'Pasang Sekarang'}</span>
                </button>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-2 transition-colors"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Guide Modal (iOS & Manual Android Guide) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto animate-fade-in-up"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 flex items-center justify-center flex-shrink-0 shadow-md p-1.5">
                  <img src="/logo-transparent.png" alt="HiGO" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Pasang Higo di HP
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Panduan instalasi ke Layar Utama
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeGuideModal}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction Steps */}
            {isIOS ? (
              <div className="space-y-3.5">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                  Apple iOS memerlukan langkah penambahan manual melalui browser Safari.
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      1
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Ketuk tombol <strong className="text-gray-900 dark:text-white inline-flex items-center gap-1 mx-1"><Share className="w-3.5 h-3.5 text-blue-500 inline" /> Bagikan (Share)</strong> pada bilah menu di bawah layar Safari Anda.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      2
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Gulir daftar menu ke bawah dan pilih opsi <strong className="text-gray-900 dark:text-white inline-flex items-center gap-1 mx-1"><PlusSquare className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300 inline" /> Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      3
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Ketuk tombol <strong className="text-green-600 dark:text-green-400">Tambah (Add)</strong> di sudut kanan atas. Ikon Higo Pondok akan langsung muncul di HP Anda!
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      1
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Ketuk ikon titik tiga <strong className="text-gray-900 dark:text-white">⋮</strong> di sudut kanan atas browser Chrome / browser HP Anda.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      2
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Pilih menu <strong className="text-gray-900 dark:text-white">"Pasang aplikasi" (Install app)</strong> atau <strong className="text-gray-900 dark:text-white">"Tambahkan ke Layar Utama"</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      3
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Konfirmasi dengan menekan tombol <strong className="text-green-600 dark:text-green-400">Pasang (Install)</strong>.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={installApp}
                  className="w-full mt-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-green-600/30 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Coba Pasang Otomatis Sekarang
                </button>
              </div>
            )}

            {/* Keunggulan PWA */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Keuntungan Aplikasi Terpasang
              </h5>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span>Layar penuh tanpa bar browser</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span>Loading instan hemat kuota</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span>Buka langsung dari Layar Utama</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span>Hemat baterai & memori HP</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeGuideModal}
              className="w-full mt-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-xl text-xs transition-colors"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
