import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@tuki/shared'
import { api } from '../lib/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  registerClient: (data: RegisterClientData) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
}

interface RegisterClientData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  latitude?: number
  longitude?: number
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

          localStorage.setItem('casapp_token', accessToken)
          localStorage.setItem('casapp_refresh_token', refreshToken)

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      registerClient: async (payload) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register/client', payload)
          const { user, accessToken, refreshToken } = data.data

          localStorage.setItem('casapp_token', accessToken)
          localStorage.setItem('casapp_refresh_token', refreshToken)

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('casapp_token')
        localStorage.removeItem('casapp_refresh_token')
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'casapp-client-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
