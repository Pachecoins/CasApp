import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@casapp/shared'
import { api } from '../lib/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  registerWorker: (data: RegisterWorkerData) => Promise<void>
  logout: () => void
}

interface RegisterWorkerData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  bio?: string
  radiusKm?: number
  categoryIds?: string[]
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          const { user, accessToken, refreshToken } = data.data

          if (user.role !== 'WORKER' && user.role !== 'ADMIN') {
            throw new Error('Esta cuenta no es de profesional. Usá la app CasApp Cliente.')
          }

          localStorage.setItem('casapp_pro_token', accessToken)
          localStorage.setItem('casapp_pro_refresh_token', refreshToken)

          set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      registerWorker: async (payload) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register/worker', payload)
          const { user, accessToken, refreshToken } = data.data

          localStorage.setItem('casapp_pro_token', accessToken)
          localStorage.setItem('casapp_pro_refresh_token', refreshToken)

          set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('casapp_pro_token')
        localStorage.removeItem('casapp_pro_refresh_token')
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'casapp-worker-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
