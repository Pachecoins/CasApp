import { Router } from 'express'
import { z } from 'zod'
import * as subscriptionsService from '../services/subscriptions.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

const createSchema = z.object({
  categoryId: z.string(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  dayOfWeek: z.number().int().min(0).max(6),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'timeSlot debe tener formato HH:MM'),
  address: z.string().min(5),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  preferSameWorker: z.boolean().optional(),
  description: z.string().optional(),
})

// POST /api/subscriptions
router.post('/', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  const result = createSchema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos inválidos', 422, result.error.flatten())

  try {
    const subscription = await subscriptionsService.createSubscription({
      clientUserId: req.user!.userId,
      ...result.data,
    })
    return sendSuccess(res, subscription, 201, 'Suscripción creada exitosamente')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear suscripción'
    return sendError(res, message, 400)
  }
})

// GET /api/subscriptions/me
router.get('/me', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const subscriptions = await subscriptionsService.getClientSubscriptions(req.user!.userId)
    return sendSuccess(res, subscriptions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// GET /api/subscriptions/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const subscription = await subscriptionsService.getSubscriptionById(
      req.params.id,
      req.user!.userId,
    )
    return sendSuccess(res, subscription)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    const code = message.includes('denegado') ? 403 : 404
    return sendError(res, message, code)
  }
})

// PATCH /api/subscriptions/:id
router.patch('/:id', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  const schema = z.object({
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    timeSlot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    preferSameWorker: z.boolean().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos inválidos', 422)

  try {
    const updated = await subscriptionsService.updateSubscription(
      req.params.id,
      req.user!.userId,
      result.data,
    )
    return sendSuccess(res, updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    const code = message.includes('denegado') ? 403 : 400
    return sendError(res, message, code)
  }
})

// DELETE /api/subscriptions/:id
router.delete('/:id', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    await subscriptionsService.cancelSubscription(req.params.id, req.user!.userId)
    return sendSuccess(res, null, 200, 'Suscripción cancelada')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    const code = message.includes('denegado') ? 403 : 400
    return sendError(res, message, code)
  }
})

export default router
