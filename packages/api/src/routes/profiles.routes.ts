import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import * as profilesService from '../services/profiles.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// multer: store in memory, max 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes'))
  },
})

// ─── Public: worker profile ───────────────────────────────────────────────────

// GET /api/profiles/workers/:userId
router.get('/workers/:userId', async (req, res) => {
  try {
    const profile = await profilesService.getWorkerPublicProfile(req.params.userId)
    return sendSuccess(res, profile)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 404)
  }
})

// ─── Worker: own profile ──────────────────────────────────────────────────────

// GET /api/profiles/me
router.get('/me', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const profile = await profilesService.getOwnProfile(req.user!.userId)
    return sendSuccess(res, profile)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// PATCH /api/profiles/me
router.patch('/me', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({
    bio: z.string().max(500).optional(),
    radiusKm: z.number().min(1).max(100).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos inválidos', 422)

  try {
    const updated = await profilesService.updateWorkerProfile(req.user!.userId, result.data)
    return sendSuccess(res, updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return sendError(res, message, 400)
  }
})

// POST /api/profiles/me/avatar
router.post(
  '/me/avatar',
  authenticate,
  upload.single('avatar'),
  async (req: AuthRequest, res) => {
    if (!req.file) return sendError(res, 'No se recibió ninguna imagen', 422)
    try {
      const result = await profilesService.uploadAvatar(
        req.user!.userId,
        req.file.buffer,
        req.file.mimetype,
      )
      return sendSuccess(res, result, 200, 'Avatar actualizado')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir imagen'
      return sendError(res, message, 500)
    }
  },
)

// POST /api/profiles/me/portfolio
router.post(
  '/me/portfolio',
  authenticate,
  requireRole('WORKER'),
  upload.single('image'),
  async (req: AuthRequest, res) => {
    if (!req.file) return sendError(res, 'No se recibió ninguna imagen', 422)

    const schema = z.object({
      categoryId: z.string(),
      caption: z.string().max(200).optional(),
    })
    const result = schema.safeParse(req.body)
    if (!result.success) return sendError(res, 'categoryId requerido', 422)

    try {
      const item = await profilesService.addPortfolioItem(
        req.user!.userId,
        result.data.categoryId,
        req.file.buffer,
        req.file.mimetype,
        result.data.caption,
      )
      return sendSuccess(res, item, 201, 'Imagen agregada al portfolio')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir imagen'
      return sendError(res, message, 400)
    }
  },
)

// DELETE /api/profiles/me/portfolio/:categoryId/:itemId
router.delete(
  '/me/portfolio/:categoryId/:itemId',
  authenticate,
  requireRole('WORKER'),
  async (req: AuthRequest, res) => {
    try {
      const result = await profilesService.removePortfolioItem(
        req.user!.userId,
        req.params.categoryId,
        req.params.itemId,
      )
      return sendSuccess(res, result, 200, 'Imagen eliminada')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error'
      return sendError(res, message, 400)
    }
  },
)

export default router
