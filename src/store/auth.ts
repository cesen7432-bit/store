import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, setAuthToken } from '../services/api'
import type { RegisterRequest, TwoFactorChallenge, User } from '../types'
import { useCart } from './cart'

interface AuthState {
  token: string | null
  user: User | null
  /** Paso 1: credenciales → código enviado al celular */
  login: (email: string, password: string) => Promise<TwoFactorChallenge>
  register: (req: RegisterRequest) => Promise<TwoFactorChallenge>
  /** Paso 2: código correcto → sesión iniciada */
  verify: (challengeId: string, code: string) => Promise<User>
  logout: () => void
  /** Revalida la sesión con el backend (p. ej. al cargar la app) */
  refresh: () => Promise<void>
  setUser: (u: User) => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (email, password) => api.login(email, password),
      register: (req) => api.register(req),
      async verify(challengeId, code) {
        const s = await api.verify2fa(challengeId, code)
        setAuthToken(s.token)
        set({ token: s.token, user: s.user })
        return s.user
      },
      logout() {
        setAuthToken(null)
        useCart.getState().setCoupon(null)
        set({ token: null, user: null })
      },
      async refresh() {
        if (!get().token) return
        try {
          const u = await api.me()
          if (u) set({ user: u })
          else get().logout()
        } catch {
          get().logout()
        }
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'cecom-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => setAuthToken(state?.token ?? null),
    },
  ),
)

export const useIsAdmin = () => useAuth((s) => s.user?.role === 'admin')
