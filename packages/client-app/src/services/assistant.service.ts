import { api } from '@/lib/api'

interface RecommendedWorker {
  id: string
  user: { firstName: string; lastName: string; avatarUrl: string | null }
  rating: number
  totalReviews: number
  distanceKm: number
  estimatedArrivalMin: number
}

interface AnalyzeResponse {
  analysis: { problem: string; solution: string }
  category: { id: string; slug: string; name: string } | null
  recommendedWorkers: RecommendedWorker[]
}

export const assistantService = {
  analyze: async (payload: {
    description: string
    latitude?: number
    longitude?: number
  }): Promise<AnalyzeResponse> => {
    const { data } = await api.post('/assistant/analyze', payload)
    return data.data
  },
}
