import { Router } from 'express'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { prisma } from '../config/prisma.js'

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

export default router
