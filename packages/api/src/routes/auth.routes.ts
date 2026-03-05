import { Router } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth.service.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

const registerClientSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

const registerWorkerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  bio: z.string().optional(),
  radiusKm: z.number().min(1).max(50).optional(),
  categoryIds: z.array(z.string()).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

// POST /api/auth/register/client
router.post('/register/client', async (req, res) => {
  const result = registerClientSchema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'Validation error', 422, result.error.flatten())
  }

  try {
    const data = await authService.registerClient(result.data)
    return sendSuccess(res, data, 201, 'Cuenta creada exitosamente')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cuenta'
    return sendError(res, message, 409)
  }
})

// POST /api/auth/register/worker
router.post('/register/worker', async (req, res) => {
  const result = registerWorkerSchema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'Validation error', 422, result.error.flatten())
  }

  try {
    const data = await authService.registerWorker(result.data)
    return sendSuccess(res, data, 201, 'Cuenta profesional creada exitosamente')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cuenta'
    return sendError(res, message, 409)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'Validation error', 422, result.error.flatten())
  }

  try {
    const data = await authService.login(result.data)
    return sendSuccess(res, data, 200, 'Inicio de sesión exitoso')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al iniciar sesión'
    return sendError(res, message, 401)
  }
})

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  const result = refreshSchema.safeParse(req.body)
  if (!result.success) {
    return sendError(res, 'refreshToken required', 422)
  }

  try {
    const data = await authService.refreshToken(result.data.refreshToken)
    return sendSuccess(res, data)
  } catch {
    return sendError(res, 'Invalid or expired refresh token', 401)
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await authService.getMe(req.user!.userId)
    return sendSuccess(res, user)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener usuario'
    return sendError(res, message, 404)
  }
})

// POST /api/auth/logout
router.post('/logout', authenticate, (_req, res) => {
  // Client-side token deletion; in v2 we'd maintain a token blacklist
  return sendSuccess(res, null, 200, 'Sesión cerrada')
})

export default router
