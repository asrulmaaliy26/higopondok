import React from 'react';
import { Download, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import { usePwaStore } from '../../store/pwaStore';

export default function PwaInstallPrompt() {
  const {
    isStandalone,
    showBanner,
    showGuideModal,
    isIOS,
    installApp,
    dismissBanner,
    closeGuideModal,
  } = usePwaStore();

  // If already running standalone (installed as app), do not render banner
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Install Banner: cleanly positioned above bottom navigation on mobile/tablet (bottom-[68px]) */}
      {showBanner && (
        <div className="fixed bottom-[68px] lg:bottom-5 inset-x-2.5 sm:inset-x-auto sm:right-5 sm:max-w-sm z-[70] animate-fade-in-up">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-none p-3 shadow-xl border border-gray-200 dark:border-gray-800 flex items-start gap-2.5">
            <div className="w-10 h-10 rounded-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 p-1">
              <img
                src="/icon-192x192.png"
                alt="HiGO Pondok"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>

            <div className="flex-1 min-w-0 pr-0.5">
              <div className="flex items-center justify-between gap-1.5">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">
                  Pasang Aplikasi Higo
                </h4>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="p-1 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer rounded-none"
                  aria-label="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2 leading-tight">
                Akses cepat, hemat kuota, dan pengalaman layar penuh di HP Anda.
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={installApp}
                  className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-none shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>{isIOS ? 'Cara Pasang' : 'Pasang Sekarang'}</span>
                </button>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1.5 transition-colors cursor-pointer rounded-none border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
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
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-none p-4 sm:p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto animate-fade-in-up"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 p-1">
                  <img src="/logo-transparent.png" alt="HiGO" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Pasang Higo di HP
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Panduan instalasi ke Layar Utama
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeGuideModal}
                className="w-7 h-7 rounded-none bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Instruction Steps */}
            {isIOS ? (
              <div className="space-y-2.5">
                <div className="p-2.5 rounded-none bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                  Apple iOS memerlukan langkah penambahan manual melalui browser Safari.
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
                    <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-xs shrink-0">
                      1
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Ketuk tombol <strong className="text-gray-900 dark:text-white inline-flex items-center gap-1 mx-1"><Share className="w-3.5 h-3.5 text-blue-500 inline" /> Bagikan (Share)</strong> pada bilah menu di bawah layar Safari Anda.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
                    <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-xs shrink-0">
                      2
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Gulir daftar menu ke bawah dan pilih opsi <strong className="text-gray-900 dark:text-white inline-flex items-center gap-1 mx-1"><PlusSquare className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300 inline" /> Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
                    <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-xs shrink-0">
                      3
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Ketuk tombol <strong className="text-green-600 dark:text-green-400">Tambah (Add)</strong> di sudut kanan atas. Ikon Higo Pondok akan langsung muncul di HP Anda!
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
                    <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-xs shrink-0">
                      1
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Ketuk ikon titik tiga <strong className="text-gray-900 dark:text-white">⋮</strong> di sudut kanan atas browser Chrome / browser HP Anda.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
                    <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-xs shrink-0">
                      2
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      Pilih menu <strong className="text-gray-900 dark:text-white">"Pasang aplikasi" (Install app)</strong> atau <strong className="text-gray-900 dark:text-white">"Tambahkan ke Layar Utama"</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
                    <div className="w-6 h-6 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-xs shrink-0">
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
                  className="w-full mt-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-2 px-3 rounded-none text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Coba Pasang Otomatis Sekarang
                </button>
              </div>
            )}

            {/* Keunggulan PWA */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Keuntungan Aplikasi Terpasang
              </h5>
              <div className="grid grid-cols-2 gap-1.5 text-[10.5px] text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span>Layar penuh tanpa bar browser</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span>Loading instan hemat kuota</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span>Buka langsung dari Layar Utama</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span>Hemat baterai & memori HP</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeGuideModal}
              className="w-full mt-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-none text-xs transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
