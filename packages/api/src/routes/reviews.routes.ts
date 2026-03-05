import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// POST /api/reviews
router.post('/', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  const schema = z.object({
    serviceRequestId: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Validation error', 422, result.error.flatten())

  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: result.data.serviceRequestId },
      include: {
        client: true,
        worker: { include: { user: true } },
        review: true,
      },
    })

    if (!request) return sendError(res, 'Pedido no encontrado', 404)
    if (request.status !== 'COMPLETED') return sendError(res, 'El pedido no está completado', 400)
    if (request.review) return sendError(res, 'Ya calificaste este servicio', 409)
    if (!request.workerId) return sendError(res, 'No hay trabajador asignado', 400)

    // Verify the caller is the client of this request
    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.userId } })
    if (clientProfile?.id !== request.clientId) return sendError(res, 'Sin permiso', 403)

    const review = await prisma.review.create({
      data: {
        serviceRequestId: result.data.serviceRequestId,
        reviewerId: req.user!.userId,
        revieweeId: request.worker!.user.id,
        rating: result.data.rating,
        comment: result.data.comment,
      },
    })

    // Update worker's aggregate rating
    const workerProfile = await prisma.workerProfile.findUnique({ where: { id: request.workerId } })
    if (workerProfile) {
      const newTotal = workerProfile.totalReviews + 1
      const newRating =
        (workerProfile.rating * workerProfile.totalReviews + result.data.rating) / newTotal

      await prisma.workerProfile.update({
        where: { id: request.workerId },
        data: {
          rating: Math.round(newRating * 10) / 10,
          totalReviews: newTotal,
        },
      })
    }

    return sendSuccess(res, review, 201, 'Calificación enviada')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al guardar reseña'
    return sendError(res, message, 500)
  }
})

// GET /api/workers/:id/reviews
router.get('/workers/:workerId', async (req, res) => {
  try {
    const worker = await prisma.workerProfile.findUnique({ where: { id: req.params.workerId } })
    if (!worker) return sendError(res, 'Trabajador no encontrado', 404)

    const reviews = await prisma.review.findMany({
      where: { revieweeId: worker.userId },
      include: {
        reviewer: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return sendSuccess(res, reviews)
  } catch {
    return sendError(res, 'Error al obtener reseñas', 500)
  }
})

export default router
