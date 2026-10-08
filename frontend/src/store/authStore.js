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
      impersonate: (targetUser, targetToken) => set((state) => {
        // Cegah penimpaan akun Admin jika sedang dalam mode penyamaran (double-call guard)
        const adminUser = state.originalAdmin || state.user;
        const adminToken = state.originalToken || state.token;
        return { 
          originalAdmin: adminUser,
          originalToken: adminToken,
          user: targetUser,
          token: targetToken
        };
      }),
      stopImpersonating: () => set((state) => {
        // Jika originalAdmin null (misal terpicu dobel), jangan ubah state agar user tidak terhapus
        if (!state.originalAdmin) return state;
        return { 
          user: state.originalAdmin,
          token: state.originalToken,
          originalAdmin: null,
          originalToken: null
        };
      }),
      loginAsAdmin: async (apiInstance) => {
        try {
          const res = await (apiInstance || (await import('../lib/axios')).default).post('/login', {
            email: 'superadmin@higopondok.id',
            password: 'password'
          });
          const { user, access_token } = res.data;
          set({
            user,
            token: access_token,
            originalAdmin: null,
            originalToken: null
          });
          return true;
        } catch (e) {
          console.error('Gagal login cepat sebagai admin:', e);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
