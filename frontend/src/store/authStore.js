import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      originalAdmin: null,
      originalToken: null,
      setAuth: (user, token) => set({ user, token, originalAdmin: null, originalToken: null }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, originalAdmin: null, originalToken: null }),
      impersonate: (targetUser, targetToken) => set((state) => ({ 
        originalAdmin: state.user,
        originalToken: state.token,
        user: targetUser,
        token: targetToken
      })),
      stopImpersonating: () => set((state) => ({ 
        user: state.originalAdmin,
        token: state.originalToken,
        originalAdmin: null,
        originalToken: null
      })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
