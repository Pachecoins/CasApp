import { Router } from 'express'
import { z } from 'zod'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { savePushSubscription, removePushSubscription, isWebPushConfigured } from '../services/notifications.service.js'
import { env } from '../config/env.js'

const router = Router()

// GET /api/notifications/vapid-public-key
// Returns VAPID public key for the frontend to subscribe
router.get('/vapid-public-key', (_req, res) => {
  if (!isWebPushConfigured) {
    return res.json({ data: null, configured: false })
  }
  return res.json({ data: env.VAPID_PUBLIC_KEY, configured: true })
})

// POST /api/notifications/subscribe
router.post('/subscribe', authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Suscripción inválida', 422)

  try {
    await savePushSubscription(
      req.user!.userId,
      result.data,
      req.headers['user-agent'],
    )
    return sendSuccess(res, null, 201, 'Suscripción guardada')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// DELETE /api/notifications/subscribe
router.delete('/subscribe', authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({ endpoint: z.string().url() })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'endpoint requerido', 422)

  try {
    await removePushSubscription(result.data.endpoint)
    return sendSuccess(res, null, 200, 'Suscripción eliminada')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

export default router
