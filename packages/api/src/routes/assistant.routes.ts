import { Router } from 'express'
import { z } from 'zod'
import * as assistantService from '../services/assistant.service.js'
import { authenticate } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// POST /api/assistant/analyze
// Body: { description: string, latitude?: number, longitude?: number }
router.post('/analyze', authenticate, async (req, res) => {
  const schema = z.object({
    description: z.string().min(5).max(500),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'description (5-500 caracteres) es requerido', 422, result.error.flatten())
  }

  try {
    const data = await assistantService.analyzeAndRecommend(result.data)
    return sendSuccess(res, data)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al analizar', 500)
  }
})

export default router
