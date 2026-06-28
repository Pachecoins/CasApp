import { api } from '@/lib/api'

export interface MarketplaceProduct {
  id: string
  name: string
  description: string | null
  photoUrl: string
  priceCents: number
  stock: number
  distanceKm: number | null
  worker: { user: { firstName: string; lastName: string } }
}

export const productsService = {
  browse: async (lat?: number, lng?: number): Promise<MarketplaceProduct[]> => {
    const { data } = await api.get('/products', { params: { lat, lng } })
    return data.data
  },

  order: async (payload: { productId: string; quantity: number }) => {
    const { data } = await api.post('/products/orders', payload)
    return data.data
  },
}
