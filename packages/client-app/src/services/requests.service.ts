import { api } from '@/lib/api'
import type { ServiceType, ServiceCategory } from '@casapp/shared'

export interface CreateRequestPayload {
  categoryId: string
  type: ServiceType
  address: string
  latitude: number
  longitude: number
  description?: string
  scheduledAt?: string
  estimatedDuration?: number
}

export const requestsService = {
  create: async (payload: CreateRequestPayload) => {
    const { data } = await api.post('/requests', payload)
    return data.data
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/requests/${id}`)
    return data.data
  },

  updateStatus: async (id: string, status: string) => {
    const { data } = await api.patch(`/requests/${id}/status`, { status })
    return data.data
  },

  getMyRequests: async () => {
    const { data } = await api.get('/clients/me/requests')
    return data.data
  },
}

export const workersService = {
  getNearby: async (params: {
    lat: number
    lng: number
    categoryId?: string
    radius?: number
  }) => {
    const { data } = await api.get('/workers/nearby', { params })
    return data.data
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/workers/${id}`)
    return data.data
  },
}

export const categoriesService = {
  getAll: async (): Promise<ServiceCategory[]> => {
    const { data } = await api.get('/categories')
    return data.data
  },

  getBySlug: async (slug: string): Promise<ServiceCategory> => {
    const { data } = await api.get(`/categories/${slug}`)
    return data.data
  },
}

export const paymentsService = {
  createPreference: async (requestId: string) => {
    const { data } = await api.post('/payments/create-preference', { requestId })
    return data.data as {
      transactionId: string
      initPoint: string
      sandboxInitPoint?: string
      preferenceId: string
      isMock: boolean
    }
  },

  mockApprove: async (requestId: string) => {
    const { data } = await api.post('/payments/mock-approve', { requestId })
    return data.data
  },

  getHistory: async () => {
    const { data } = await api.get('/payments/history')
    return data.data
  },

  getTransaction: async (id: string) => {
    const { data } = await api.get(`/payments/${id}`)
    return data.data
  },
}
