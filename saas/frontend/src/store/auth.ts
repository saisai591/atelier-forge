import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Tenant } from '../types'

interface AuthState {
  accessToken: string | null
  user: User | null
  tenant: Tenant | null
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  setTenant: (tenant: Tenant) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      tenant: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      setTenant: (tenant) => set({ tenant }),
      logout: () => set({ accessToken: null, user: null, tenant: null }),
    }),
    { name: 'forge-auth', partialize: (s) => ({ user: s.user, tenant: s.tenant }) },
  ),
)
