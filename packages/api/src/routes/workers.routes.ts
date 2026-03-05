import { Router } from 'express'
import { z } from 'zod'
import * as workersService from '../services/workers.service.js'
import * as requestsService from '../services/requests.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// GET /api/workers/nearby?lat=&lng=&categoryId=&radius=
router.get('/nearby', async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    categoryId: z.string().optional(),
    radius: z.coerce.number().min(1).max(50).default(15),
    limit: z.coerce.number().min(1).max(50).default(20),
  })

  const result = schema.safeParse(req.query)
  if (!result.success) {
    return sendError(res, 'lat y lng son requeridos', 422, result.error.flatten())
  }

  try {
    const workers = await workersService.getNearbyWorkers(result.data)
    return sendSuccess(res, workers)
  } catch {
    return sendError(res, 'Error al buscar trabajadores', 500)
  }
})

// GET /api/workers/me/dashboard
router.get('/me/dashboard', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const data = await workersService.getWorkerDashboard(req.user!.userId)
    return sendSuccess(res, data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener dashboard'
    return sendError(res, message, 404)
  }
})

// PATCH /api/workers/me/availability
router.patch(
  '/me/availability',
  authenticate,
  requireRole('WORKER'),
  async (req: AuthRequest, res) => {
    const schema = z.object({ isAvailable: z.boolean() })
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return sendError(res, 'isAvailable (boolean) requerido', 422)
    }

    try {
      const worker = await workersService.updateAvailability(
        req.user!.userId,
        result.data.isAvailable,
      )
      return sendSuccess(res, worker)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar disponibilidad'
      return sendError(res, message, 400)
    }
  },
)

// PATCH /api/workers/me/location
router.patch(
  '/me/location',
  authenticate,
  requireRole('WORKER'),
  async (req: AuthRequest, res) => {
    const schema = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return sendError(res, 'latitude y longitude requeridos', 422)
    }

    try {
      const worker = await workersService.updateLocation(
        req.user!.userId,
        result.data.latitude,
        result.data.longitude,
      )
      return sendSuccess(res, worker)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar ubicación'
      return sendError(res, message, 400)
    }
  },
)

// GET /api/workers/me/requests
router.get('/me/requests', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const requests = await requestsService.getWorkerRequests(req.user!.userId)
    return sendSuccess(res, requests)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// GET /api/workers/:id
router.get('/:id', async (req, res) => {
  try {
    const worker = await workersService.getWorkerById(req.params.id)
    return sendSuccess(res, worker)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 404)
  }
})

export default router
