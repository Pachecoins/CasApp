import { api } from '@/lib/api'

export interface RentalEquipment {
  id: string
  name: string
  description: string | null
  photoUrl: string
  pricePerDayCents: number
  distanceKm: number | null
  worker: { user: { firstName: string; lastName: string } }
}

export const equipmentService = {
  browse: async (lat?: number, lng?: number): Promise<RentalEquipment[]> => {
    const { data } = await api.get('/equipment/rentals', { params: { lat, lng } })
    return data.data
  },

  reserve: async (payload: { equipmentId: string; startDate: string; endDate: string }) => {
    const { data } = await api.post('/equipment/rentals', payload)
    return data.data
  },

  getMyRentals: async () => {
    const { data } = await api.get('/equipment/rentals/mine')
    return data.data
  },
}
