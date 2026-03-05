import { Router } from 'express'
import { z } from 'zod'
import * as paymentsService from '../services/payments.service.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// POST /api/payments/create-preference
// Creates a MercadoPago preference for a pending-payment request
router.post('/create-preference', authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({ requestId: z.string() })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'requestId requerido', 422)

  try {
    const preference = await paymentsService.createPaymentPreference(
      result.data.requestId,
      req.user!.userId,
    )
    return sendSuccess(res, preference, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear preferencia'
    return sendError(res, message, 400)
  }
})

// POST /api/payments/webhook
// MercadoPago IPN / webhook — public endpoint
router.post('/webhook', async (req, res) => {
  try {
    const topic = (req.query.topic as string) || (req.body?.type as string)
    const resourceId =
      (req.query.id as string) ||
      (req.body?.data?.id as string)

    if (!topic || !resourceId) {
      return res.status(200).json({ ignored: true })
    }

    const result = await paymentsService.processWebhook(topic, resourceId, req.body)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[Webhook] Error processing payment webhook:', err)
    // Always return 200 to MP so it doesn't retry
    return res.status(200).json({ error: true })
  }
})

// POST /api/payments/mock-approve (DEV ONLY)
// Simulates a payment approval for development without real MP credentials
router.post('/mock-approve', authenticate, async (req: AuthRequest, res) => {
  if (process.env.NODE_ENV === 'production') {
    return sendError(res, 'No disponible en producción', 403)
  }

  const schema = z.object({ requestId: z.string() })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'requestId requerido', 422)

  try {
    const request = await paymentsService.approveMockPayment(result.data.requestId)
    return sendSuccess(res, request, 200, 'Pago aprobado (modo desarrollo)')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// GET /api/payments/history
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const history = await paymentsService.getPaymentHistory(
      req.user!.userId,
      req.user!.role,
    )
    return sendSuccess(res, history)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// GET /api/payments/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const tx = await paymentsService.getTransaction(
      req.params.id,
      req.user!.userId,
      req.user!.role,
    )
    return sendSuccess(res, tx)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    const code = message.includes('denegado') ? 403 : 404
    return sendError(res, message, code)
  }
})

export default router
