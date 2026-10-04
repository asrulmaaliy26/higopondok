import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCanteenStore = create(
  persist(
    (set) => ({
      activeCanteenId: null,
      isStoreSelected: false,
      setActiveCanteenId: (id) => set({ activeCanteenId: id, isStoreSelected: true }),
      setIsStoreSelected: (status) => set({ isStoreSelected: status }),
      clearActiveCanteen: () => set({ activeCanteenId: null, isStoreSelected: false }),
    }),
    {
      name: 'canteen-storage',
      partialize: (state) => ({ activeCanteenId: state.activeCanteenId }), // Only persist activeCanteenId
    }
  )
);
