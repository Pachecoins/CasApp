import { api } from '@/lib/api'
import type { LotSize, EquipmentTier, ServiceCategory } from '@tuki/shared'

export interface CreateRequestPayload {
  categoryId: string
  type?: 'ON_DEMAND' | 'SCHEDULED'
  address: string
  latitude: number
  longitude: number
  lotSize?: LotSize
  lotAreaM2?: number
  addons?: string[]
  equipmentTier?: EquipmentTier
  description?: string
  scheduledAt?: string
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

  updateStatus: async (id: string, status: string, reason?: string) => {
    const { data } = await api.patch(`/requests/${id}/status`, {
      status,
      ...(reason ? { disputeReason: reason } : {}),
    })
    return data.data
  },

  getMyRequests: async () => {
    const { data } = await api.get('/clients/me/requests')
    return data.data
  },
}

export const clientProfileService = {
  getProfile: async () => {
    const { data } = await api.get('/clients/me/profile')
    return data.data as {
      id: string
      user: { id: string; firstName: string; lastName: string; email: string; phone?: string; avatarUrl?: string }
      addresses: ClientAddress[]
    }
  },

  getAddresses: async () => {
    const { data } = await api.get('/clients/me/addresses')
    return data.data as ClientAddress[]
  },

  addAddress: async (payload: {
    label: string
    address: string
    latitude: number
    longitude: number
    isGatedCommunity?: boolean
    isDefault?: boolean
  }) => {
    const { data } = await api.post('/clients/me/addresses', payload)
    return data.data as ClientAddress
  },

  deleteAddress: async (addressId: string) => {
    await api.delete(`/clients/me/addresses/${addressId}`)
  },
}

interface ClientAddress {
  id: string
  clientId: string
  label: string
  address: string
  latitude: number
  longitude: number
  isGatedCommunity: boolean
  isDefault: boolean
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

export const subscriptionsService = {
  create: async (payload: {
    categoryId: string
    frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
    dayOfWeek: number
    timeSlot: string
    address: string
    latitude: number
    longitude: number
    preferSameWorker?: boolean
    description?: string
  }) => {
    const { data } = await api.post('/subscriptions', payload)
    return data.data
  },

  getMySubscriptions: async () => {
    const { data } = await api.get('/subscriptions/me')
    return data.data
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/subscriptions/${id}`)
    return data.data
  },

  update: async (
    id: string,
    payload: { dayOfWeek?: number; timeSlot?: string; preferSameWorker?: boolean },
  ) => {
    const { data } = await api.patch(`/subscriptions/${id}`, payload)
    return data.data
  },

  cancel: async (id: string) => {
    const { data } = await api.delete(`/subscriptions/${id}`)
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
