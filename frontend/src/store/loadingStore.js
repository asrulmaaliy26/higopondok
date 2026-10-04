import { create } from 'zustand';

export const useLoadingStore = create((set) => ({
  activeRequests: 0,
  startLoading: () => set((state) => ({ activeRequests: state.activeRequests + 1 })),
  stopLoading: () =>
    set((state) => ({
      activeRequests: Math.max(0, state.activeRequests - 1),
    })),
  resetLoading: () => set({ activeRequests: 0 }),
}));
