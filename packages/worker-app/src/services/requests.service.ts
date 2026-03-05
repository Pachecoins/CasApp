import { api } from '@/lib/api'

export const workerRequestsService = {
  accept: async (requestId: string) => {
    const { data } = await api.post(`/requests/${requestId}/accept`)
    return data.data
  },

  reject: async (requestId: string) => {
    const { data } = await api.post(`/requests/${requestId}/reject`)
    return data.data
  },

  getById: async (requestId: string) => {
    const { data } = await api.get(`/requests/${requestId}`)
    return data.data
  },

  updateStatus: async (requestId: string, status: string) => {
    const { data } = await api.patch(`/requests/${requestId}/status`, { status })
    return data.data
  },

  getMyRequests: async () => {
    const { data } = await api.get('/workers/me/requests')
    return data.data
  },

  updateAvailability: async (isAvailable: boolean) => {
    const { data } = await api.patch('/workers/me/availability', { isAvailable })
    return data.data
  },

  updateLocation: async (latitude: number, longitude: number) => {
    const { data } = await api.patch('/workers/me/location', { latitude, longitude })
    return data.data
  },
}
