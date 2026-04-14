import { Router } from 'express'
import { z } from 'zod'
import * as workersService from '../services/workers.service.js'
import * as requestsService from '../services/requests.service.js'
import * as matchingService from '../services/matching.service.js'
import * as kycService from '../services/kyc.service.js'
import * as paymentsService from '../services/payments.service.js'
import { handleKycWebhook } from '../services/kyc.service.js'
import { deductWalletForWithdrawal } from '../services/escrow.service.js'
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

// GET /api/workers/me/available-jobs
// Returns SEARCHING orders near the worker, sorted by distance, with earnings estimate
router.get('/me/available-jobs', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const jobs = await matchingService.getAvailableJobsForWorker(req.user!.userId)
    return sendSuccess(res, jobs)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

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

// ─── KYC & DOCUMENT UPLOAD ────────────────────────────────────────────────────

// GET /api/workers/me/onboarding-status
router.get('/me/onboarding-status', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId }, select: { id: true } })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)
    const status = await kycService.getOnboardingStatus(worker.id)
    return sendSuccess(res, status)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/workers/me/kyc/identity
// Body: { dniFrontBase64, dniBackBase64, selfieBase64 }
router.post('/me/kyc/identity', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({
    dniFrontBase64: z.string().min(100),
    dniBackBase64: z.string().min(100),
    selfieBase64: z.string().min(100),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Imágenes requeridas (base64)', 422)

  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId }, select: { id: true } })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)

    await kycService.submitIdentityVerification(worker.id, result.data)
    return sendSuccess(res, { message: 'Documentos enviados para verificación' })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al enviar documentos', 500)
  }
})

// POST /api/workers/kyc/webhook  (public — called by KYC provider)
router.post('/kyc/webhook', async (req, res) => {
  try {
    await handleKycWebhook(req.body)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[KYC Webhook]', err)
    return res.status(200).json({ ok: true }) // always 200 so provider doesn't retry
  }
})

// POST /api/workers/me/kyc/insurance
// Body: { policyBase64, expiresAt? }
router.post('/me/kyc/insurance', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({ policyBase64: z.string().min(100) })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Imagen de póliza requerida (base64)', 422)

  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId }, select: { id: true } })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)

    const url = await kycService.uploadInsurancePolicy(worker.id, result.data.policyBase64)
    return sendSuccess(res, { insurancePolicyUrl: url, message: 'Póliza enviada. Un revisor la aprobará en breve.' })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al subir póliza', 500)
  }
})

// POST /api/workers/me/equipment
// Body: { name, description?, photoBase64 }
router.post('/me/equipment', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(200).optional(),
    photoBase64: z.string().min(100),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'name y photoBase64 requeridos', 422)

  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId }, select: { id: true } })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)

    const equipment = await kycService.uploadEquipmentPhoto(
      worker.id,
      result.data.name,
      result.data.photoBase64,
      result.data.description,
    )
    return sendSuccess(res, equipment)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al subir equipo', 500)
  }
})

// ─── MERCADOPAGO MARKETPLACE CONNECT ─────────────────────────────────────────

// GET /api/workers/me/mp/connect-url
// Returns the URL the worker should open to link their MP account
router.get('/me/mp/connect-url', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId }, select: { id: true } })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)

    const url = paymentsService.getMpConnectUrl(worker.id)
    return sendSuccess(res, { url })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// GET /api/workers/mp/callback  (called by MP after OAuth)
router.get('/mp/callback', async (req, res) => {
  const { code, state: workerId } = req.query as { code?: string; state?: string }
  if (!code || !workerId) return res.status(400).send('Invalid OAuth callback')

  try {
    await paymentsService.handleMpOAuthCallback(code, workerId)
    // Redirect worker back to the app with success indicator
    const { env } = await import('../config/env.js')
    return res.redirect(`${env.WORKER_APP_URL}/profile?mp_connected=1`)
  } catch (err) {
    console.error('[MP OAuth]', err)
    const { env } = await import('../config/env.js')
    return res.redirect(`${env.WORKER_APP_URL}/profile?mp_error=1`)
  }
})

// ─── WALLET & WITHDRAWAL ──────────────────────────────────────────────────────

// GET /api/workers/me/wallet
router.get('/me/wallet', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { walletBalanceCents: true, bankCvu: true, bankAccountVerified: true, mpUserId: true },
    })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)
    return sendSuccess(res, {
      balanceCents: worker.walletBalanceCents,
      balanceARS: worker.walletBalanceCents / 100,
      bankCvu: worker.bankCvu,
      bankAccountVerified: worker.bankAccountVerified,
      mpConnected: !!worker.mpUserId,
    })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/workers/me/wallet/withdraw
// Body: { amountARS: number }
router.post('/me/wallet/withdraw', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({ amountARS: z.number().positive() })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'amountARS requerido', 422)

  try {
    const { prisma } = await import('../config/prisma.js')
    const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId }, select: { id: true } })
    if (!worker) return sendError(res, 'Perfil no encontrado', 404)

    const amountCents = Math.round(result.data.amountARS * 100)
    await deductWalletForWithdrawal(worker.id, amountCents)
    // TODO: trigger actual bank transfer via MP / Bind API
    return sendSuccess(res, { message: 'Retiro solicitado. Se acreditará en 1-2 días hábiles.' })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al solicitar retiro', 400)
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
