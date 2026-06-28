import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { prisma } from '../config/prisma.js'
import * as kycService from '../services/kyc.service.js'
import { resolveDisputeForClient, resolveDisputeForWorker } from '../services/escrow.service.js'

const router = Router()

// All admin routes require ADMIN role
router.use(authenticate, requireRole('ADMIN'))

// GET /api/admin/stats
router.get('/stats', async (_req, res) => {
  try {
    const [
      totalUsers,
      totalWorkers,
      totalClients,
      pendingVerifications,
      totalRequests,
      completedRequests,
      totalRevenue,
      activeSubscriptions,
      recentRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.workerProfile.count(),
      prisma.clientProfile.count(),
      prisma.workerProfile.count({ where: { isVerified: false } }),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.transaction.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.serviceRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          category: { select: { name: true } },
          client: { include: { user: { select: { firstName: true, lastName: true } } } },
          worker: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ])

    return sendSuccess(res, {
      users: { total: totalUsers, workers: totalWorkers, clients: totalClients, pendingVerifications },
      requests: { total: totalRequests, completed: completedRequests },
      revenue: { total: totalRevenue._sum.amount ?? 0 },
      subscriptions: { active: activeSubscriptions },
      recentRequests,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 500)
  }
})

// GET /api/admin/workers — list all workers with verification status
router.get('/workers', async (req: AuthRequest, res) => {
  const page = parseInt((req.query.page as string) ?? '1', 10)
  const limit = 20
  const offset = (page - 1) * limit
  const filter = (req.query.filter as string) ?? 'all'

  try {
    const where = filter === 'unverified' ? { isVerified: false } : {}
    const [workers, total] = await Promise.all([
      prisma.workerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, avatarUrl: true } },
          workerServices: { where: { isActive: true }, include: { category: { select: { name: true } } } },
        },
        orderBy: { user: { createdAt: 'desc' } },
        skip: offset,
        take: limit,
      }),
      prisma.workerProfile.count({ where }),
    ])
    return sendSuccess(res, { workers, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 500)
  }
})

// PATCH /api/admin/workers/:userId/verify
router.patch('/workers/:userId/verify', async (req, res) => {
  const { verified } = req.body as { verified: boolean }
  try {
    const updated = await prisma.workerProfile.update({
      where: { userId: req.params.userId },
      data: { isVerified: verified ?? true },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })
    return sendSuccess(res, updated, 200, `Trabajador ${verified ? 'verificado' : 'desverificado'}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// ─── KYC REVIEW ──────────────────────────────────────────────────────────────

// GET /api/admin/kyc/pending — workers with submitted identity docs or pending insurance
router.get('/kyc/pending', async (_req, res) => {
  try {
    const workers = await prisma.workerProfile.findMany({
      where: {
        OR: [
          { kycStatus: 'SUBMITTED' },
          { insurancePolicyUrl: { not: null }, insuranceVerified: false },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { user: { createdAt: 'asc' } },
    })
    return sendSuccess(res, workers)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// PATCH /api/admin/workers/:workerId/approve-kyc  (manual override)
router.patch('/workers/:workerId/approve-kyc', async (req, res) => {
  try {
    await kycService.approveKycManually(req.params.workerId)
    return sendSuccess(res, {}, 200, 'Identidad aprobada')
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// PATCH /api/admin/workers/:workerId/approve-insurance
// Body: { expiresAt?: string (ISO date) }
router.patch('/workers/:workerId/approve-insurance', async (req, res) => {
  const schema = z.object({ expiresAt: z.string().optional() })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Payload inválido', 422)

  try {
    const expiresAt = result.data.expiresAt
      ? new Date(result.data.expiresAt)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // default 1 year
    await kycService.approveInsurance(req.params.workerId, expiresAt)
    return sendSuccess(res, {}, 200, 'Seguro aprobado')
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// PATCH /api/admin/workers/:workerId/reject-insurance
router.patch('/workers/:workerId/reject-insurance', async (req, res) => {
  try {
    await kycService.rejectInsurance(req.params.workerId)
    return sendSuccess(res, {}, 200, 'Seguro rechazado')
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// GET /api/admin/transactions — recent transactions
router.get('/transactions', async (req: AuthRequest, res) => {
  const page = parseInt((req.query.page as string) ?? '1', 10)
  const limit = 20
  try {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          serviceRequest: {
            include: {
              category: { select: { name: true } },
              client: { include: { user: { select: { firstName: true, lastName: true } } } },
              worker: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      }),
      prisma.transaction.count(),
    ])
    return sendSuccess(res, { transactions, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 500)
  }
})

// ─── DISPUTES ────────────────────────────────────────────────────────────────

// GET /api/admin/disputes
router.get('/disputes', async (_req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        serviceRequest: {
          select: {
            id: true,
            status: true,
            quotedPrice: true,
            address: true,
            category: { select: { name: true } },
            client: { include: { user: { select: { firstName: true, lastName: true } } } },
            worker: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    })
    return sendSuccess(res, disputes)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// PATCH /api/admin/disputes/:id/resolve
// Body: { side: 'CLIENT' | 'WORKER', resolution: string }
router.patch('/disputes/:id/resolve', async (req: AuthRequest, res) => {
  const schema = z.object({
    side: z.enum(['CLIENT', 'WORKER']),
    resolution: z.string().min(5, 'Ingresá una resolución con al menos 5 caracteres'),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'side y resolution requeridos', 422, result.error.flatten())

  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      select: { serviceRequestId: true, resolvedAt: true },
    })
    if (!dispute) return sendError(res, 'Disputa no encontrada', 404)
    if (dispute.resolvedAt) return sendError(res, 'Esta disputa ya fue resuelta', 400)

    if (result.data.side === 'CLIENT') {
      await resolveDisputeForClient({
        serviceRequestId: dispute.serviceRequestId,
        resolvedByUserId: req.user!.userId,
        resolution: result.data.resolution,
      })
    } else {
      await resolveDisputeForWorker({
        serviceRequestId: dispute.serviceRequestId,
        resolvedByUserId: req.user!.userId,
        resolution: result.data.resolution,
      })
    }
    return sendSuccess(res, {}, 200, `Resuelto a favor del ${result.data.side === 'CLIENT' ? 'cliente' : 'trabajador'}`)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// GET /api/admin/users
router.get('/users', async (req: AuthRequest, res) => {
  const page = parseInt((req.query.page as string) ?? '1', 10)
  const q = (req.query.q as string) ?? ''
  const limit = 20
  try {
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true, avatarUrl: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])
    return sendSuccess(res, { users, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 500)
  }
})

// ─── COURSES CATALOG ─────────────────────────────────────────────────────────

// GET /api/admin/courses
router.get('/courses', async (_req, res) => {
  try {
    const courses = await prisma.course.findMany({ orderBy: { createdAt: 'desc' } })
    return sendSuccess(res, courses)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/admin/courses
router.post('/courses', async (req, res) => {
  const schema = z.object({
    title: z.string().min(2).max(120),
    description: z.string().max(500).optional(),
    thumbnailUrl: z.string().url().optional(),
    contentUrl: z.string().url().optional(),
    priceCents: z.number().int().min(0).default(0),
    freeAboveRating: z.number().min(0).max(5).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos del curso inválidos', 422, result.error.flatten())

  try {
    const course = await prisma.course.create({ data: result.data })
    return sendSuccess(res, course, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al crear curso', 400)
  }
})

// PATCH /api/admin/courses/:id
router.patch('/courses/:id', async (req, res) => {
  const schema = z.object({
    title: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional(),
    thumbnailUrl: z.string().url().optional(),
    contentUrl: z.string().url().optional(),
    priceCents: z.number().int().min(0).optional(),
    freeAboveRating: z.number().min(0).max(5).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos inválidos', 422)

  try {
    const course = await prisma.course.update({ where: { id: req.params.id }, data: result.data })
    return sendSuccess(res, course)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

export default router
