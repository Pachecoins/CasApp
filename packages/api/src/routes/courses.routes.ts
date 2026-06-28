import { Router } from 'express'
import { z } from 'zod'
import * as coursesService from '../services/courses.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// GET /api/courses  (catalog, with per-worker free/enrollment info if authenticated as a worker)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const isWorker = req.user!.role === 'WORKER'
    const courses = await coursesService.listCourses(isWorker ? req.user!.userId : undefined)
    return sendSuccess(res, courses)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// GET /api/courses/me  (worker's own enrollments)
router.get('/me', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const enrollments = await coursesService.getMyEnrollments(req.user!.userId)
    return sendSuccess(res, enrollments)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/courses/:id/enroll
router.post('/:id/enroll', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({ id: z.string() })
  const result = schema.safeParse(req.params)
  if (!result.success) return sendError(res, 'Curso inválido', 422)

  try {
    const enrollment = await coursesService.enroll(req.user!.userId, result.data.id)
    return sendSuccess(res, enrollment, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al inscribirse', 400)
  }
})

export default router
