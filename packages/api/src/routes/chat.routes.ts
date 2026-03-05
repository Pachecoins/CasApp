import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// GET /api/chat/:requestId — history
router.get('/:requestId', authenticate, async (req: AuthRequest, res) => {
  try {
    // Verify user has access to this request
    const request = await prisma.serviceRequest.findUnique({
      where: { id: req.params.requestId },
      include: { client: true, worker: true },
    })
    if (!request) return sendError(res, 'Pedido no encontrado', 404)

    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.userId } })
    const workerProfile = await prisma.workerProfile.findUnique({ where: { userId: req.user!.userId } })
    const isAdmin = req.user!.role === 'ADMIN'

    if (!isAdmin && clientProfile?.id !== request.clientId && workerProfile?.id !== request.workerId) {
      return sendError(res, 'Sin acceso', 403)
    }

    const messages = await prisma.chatMessage.findMany({
      where: { serviceRequestId: req.params.requestId },
      orderBy: { createdAt: 'asc' },
    })
    return sendSuccess(res, messages)
  } catch {
    return sendError(res, 'Error al obtener mensajes', 500)
  }
})

export default router
