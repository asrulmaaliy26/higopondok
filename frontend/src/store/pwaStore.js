import { create } from 'zustand';

function checkIsStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function checkIsIOS() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !window.MSStream;
}

export const usePwaStore = create((set, get) => ({
  deferredPrompt: null,
  canInstall: false,
  isStandalone: checkIsStandalone(),
  isIOS: checkIsIOS(),
  showBanner: false,
  showGuideModal: false,

  initPwa: () => {
    if (typeof window === 'undefined') return;

    const isStandalone = checkIsStandalone();
    const isIOS = checkIsIOS();
    set({ isStandalone, isIOS });

    if (isStandalone) {
      set({ showBanner: false, canInstall: false });
      return;
    }

    // Check if dismissed recently (within 24 hours)
    const dismissedAt = localStorage.getItem('higo_pwa_dismissed_at');
    const isRecentlyDismissed = dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 24 * 60 * 60 * 1000;

    // Listen to beforeinstallprompt event on Android/Chrome/Edge
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      set({
        deferredPrompt: e,
        canInstall: true,
        showBanner: !isRecentlyDismissed,
      });
    });

    // Listen to app installed event
    window.addEventListener('appinstalled', () => {
      set({
        deferredPrompt: null,
        canInstall: false,
        isStandalone: true,
        showBanner: false,
        showGuideModal: false,
      });
      localStorage.removeItem('higo_pwa_dismissed_at');
    });

    // If on iOS and not standalone and not recently dismissed, allow banner
    if (isIOS && !isStandalone && !isRecentlyDismissed) {
      set({
        canInstall: true,
        showBanner: true,
      });
    }
  },

  installApp: async () => {
    const { deferredPrompt, isIOS } = get();

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          set({
            deferredPrompt: null,
            canInstall: false,
            showBanner: false,
          });
        }
      } catch (err) {
        console.error('Error saat instalasi PWA:', err);
      }
      return;
    }

    // On iOS or fallback, show step-by-step visual install guide modal
    if (isIOS || !deferredPrompt) {
      set({ showGuideModal: true });
    }
  },

  dismissBanner: () => {
    localStorage.setItem('higo_pwa_dismissed_at', Date.now().toString());
    set({ showBanner: false });
  },

  openGuideModal: () => set({ showGuideModal: true }),
  closeGuideModal: () => set({ showGuideModal: false }),
}));
