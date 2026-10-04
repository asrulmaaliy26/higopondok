import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const applyThemeToDOM = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  const isDark = theme === 'dark';

  if (isDark) {
    root.classList.add('dark');
    if (body) body.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    if (body) body.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
};

// Immediate sync on load
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('higo-theme-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.theme) {
        applyThemeToDOM(parsed.state.theme);
      }
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyThemeToDOM('dark');
    }
  } catch (e) {}
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) ? 'dark' : 'light',
      toggleTheme: () => set((state) => {
        const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
        applyThemeToDOM(nextTheme);
        return { theme: nextTheme };
      }),
      setTheme: (newTheme) => {
        applyThemeToDOM(newTheme);
        set({ theme: newTheme });
      },
      initTheme: () => {
        const currentTheme = get().theme || 'light';
        applyThemeToDOM(currentTheme);
      }
    }),
    {
      name: 'higo-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemeToDOM(state.theme);
        }
      },
    }
  )
);

