import { Router } from 'express'
import { z } from 'zod'
import * as requestsService from '../services/requests.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

const createRequestSchema = z.object({
  categoryId: z.string(),
  type: z.enum(['ON_DEMAND', 'SCHEDULED', 'SUBSCRIPTION']),
  address: z.string().min(5),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  estimatedDuration: z.number().optional(),
})

// POST /api/requests
router.post('/', authenticate, requireRole('CLIENT', 'ADMIN'), async (req: AuthRequest, res) => {
  const result = createRequestSchema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'Validation error', 422, result.error.flatten())
  }

  if (result.data.type === 'SCHEDULED' && !result.data.scheduledAt) {
    return sendError(res, 'scheduledAt es requerido para pedidos programados', 422)
  }

  try {
    const request = await requestsService.createRequest({
      clientUserId: req.user!.userId,
      ...result.data,
    })
    return sendSuccess(res, request, 201, 'Pedido creado exitosamente')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear pedido'
    return sendError(res, message, 400)
  }
})

// GET /api/requests/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const request = await requestsService.getRequestById(
      req.params.id,
      req.user!.userId,
      req.user!.role,
    )
    return sendSuccess(res, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    const code = message.includes('acceso') ? 403 : 404
    return sendError(res, message, code)
  }
})

// PATCH /api/requests/:id/status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    status: z.enum([
      'EN_ROUTE', 'IN_PROGRESS', 'FINISHED_PENDING_APPROVAL',
      'COMPLETED', 'CANCELLED', 'DISPUTED',
    ]),
    // Worker sends base64 photo when transitioning to FINISHED_PENDING_APPROVAL
    completionPhotoBase64: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'status inválido', 422, result.error.flatten())
  }

  try {
    // Upload completion photo to Cloudinary if provided
    let completionPhotoUrl: string | undefined
    if (result.data.status === 'FINISHED_PENDING_APPROVAL' && result.data.completionPhotoBase64) {
      const { uploadDocument } = await import('../services/kyc.service.js')
      const { prisma } = await import('../config/prisma.js')
      const workerProfile = await prisma.workerProfile.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true },
      })
      if (workerProfile) {
        completionPhotoUrl = await uploadDocument(
          result.data.completionPhotoBase64,
          workerProfile.id,
          'completion_photo' as never,
        )
      }
    }

    const updated = await requestsService.updateRequestStatus(
      req.params.id,
      req.user!.userId,
      result.data.status,
      req.user!.role,
      { completionPhotoUrl },
    )
    return sendSuccess(res, updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// POST /api/requests/:id/accept  (worker only)
router.post(
  '/:id/accept',
  authenticate,
  requireRole('WORKER'),
  async (req: AuthRequest, res) => {
    try {
      const request = await requestsService.acceptRequest(req.params.id, req.user!.userId)
      return sendSuccess(res, request, 200, 'Pedido aceptado')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al aceptar pedido'
      return sendError(res, message, 400)
    }
  },
)

// POST /api/requests/:id/reject  (worker only)
router.post(
  '/:id/reject',
  authenticate,
  requireRole('WORKER'),
  async (req: AuthRequest, res) => {
    try {
      const result = await requestsService.rejectRequest(req.params.id, req.user!.userId)
      return sendSuccess(res, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error'
      return sendError(res, message, 400)
    }
  },
)

// GET /api/clients/me/requests  (montado en /api/clients)
export const clientRequestsRouter = Router()

// GET /api/clients/me/profile
clientRequestsRouter.get('/me/profile', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const { prisma } = await import('../config/prisma.js')
    const client = await prisma.clientProfile.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    })
    if (!client) return sendError(res, 'Perfil no encontrado', 404)
    return sendSuccess(res, client)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// GET /api/clients/me/addresses
clientRequestsRouter.get('/me/addresses', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const { prisma } = await import('../config/prisma.js')
    const client = await prisma.clientProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true },
    })
    if (!client) return sendError(res, 'Perfil no encontrado', 404)
    const addresses = await prisma.clientAddress.findMany({
      where: { clientId: client.id },
      orderBy: { isDefault: 'desc' },
    })
    return sendSuccess(res, addresses)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/clients/me/addresses
clientRequestsRouter.post('/me/addresses', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  const schema = z.object({
    label: z.string().min(1).max(50),
    address: z.string().min(5),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isGatedCommunity: z.boolean().default(false),
    isDefault: z.boolean().default(false),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos inválidos', 422, result.error.flatten())

  try {
    const { prisma } = await import('../config/prisma.js')
    const client = await prisma.clientProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true },
    })
    if (!client) return sendError(res, 'Perfil no encontrado', 404)

    // If setting as default, unset previous default
    if (result.data.isDefault) {
      await prisma.clientAddress.updateMany({
        where: { clientId: client.id },
        data: { isDefault: false },
      })
    }

    const newAddress = await prisma.clientAddress.create({
      data: { clientId: client.id, ...result.data },
    })
    return sendSuccess(res, newAddress, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// DELETE /api/clients/me/addresses/:addressId
clientRequestsRouter.delete('/me/addresses/:addressId', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const { prisma } = await import('../config/prisma.js')
    const client = await prisma.clientProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true },
    })
    if (!client) return sendError(res, 'Perfil no encontrado', 404)

    const deleted = await prisma.clientAddress.deleteMany({
      where: { id: req.params.addressId, clientId: client.id },
    })
    if (deleted.count === 0) return sendError(res, 'Dirección no encontrada', 404)
    return sendSuccess(res, {}, 200, 'Dirección eliminada')
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

clientRequestsRouter.get('/me/requests', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const requests = await requestsService.getClientRequests(req.user!.userId)
    return sendSuccess(res, requests)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// GET /api/workers/me/requests  (montado en /api/workers — ya existe el router, se re-exporta aquí)
export const workerRequestsHandler = async (req: AuthRequest, res: ReturnType<typeof res>) => {
  try {
    const requests = await requestsService.getWorkerRequests(req.user!.userId)
    return sendSuccess(res as never, requests)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res as never, message, 400)
  }
}

export default router
