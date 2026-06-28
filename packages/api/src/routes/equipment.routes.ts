import { Router } from 'express'
import { z } from 'zod'
import * as equipmentService from '../services/equipment.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// GET /api/equipment/rentals?lat=&lng=&radius=
router.get('/rentals', async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(200).default(30),
  })
  const result = schema.safeParse(req.query)
  if (!result.success) return sendError(res, 'Parámetros inválidos', 422)

  try {
    const items = await equipmentService.browseRentals(result.data)
    return sendSuccess(res, items)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/equipment/rentals  Body: { equipmentId, startDate, endDate }
router.post('/rentals', authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    equipmentId: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'equipmentId, startDate y endDate requeridos', 422)

  try {
    const rental = await equipmentService.createRental(req.user!.userId, result.data)
    return sendSuccess(res, rental, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al crear la reserva', 400)
  }
})

// GET /api/equipment/rentals/mine  (client's own bookings)
router.get('/rentals/mine', authenticate, async (req: AuthRequest, res) => {
  try {
    const rentals = await equipmentService.getMyRentals(req.user!.userId)
    return sendSuccess(res, rentals)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// GET /api/equipment/me  (worker's own equipment items)
router.get('/me', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const items = await equipmentService.getOwnEquipment(req.user!.userId)
    return sendSuccess(res, items)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// GET /api/equipment/me/rentals  (worker's incoming bookings)
router.get('/me/rentals', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const rentals = await equipmentService.getOwnerRentals(req.user!.userId)
    return sendSuccess(res, rentals)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// PATCH /api/equipment/rentals/:id/status  Body: { status }
router.patch('/rentals/:id/status', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({ status: z.enum(['CONFIRMED', 'CANCELLED', 'ACTIVE', 'COMPLETED']) })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'status inválido', 422)

  try {
    const rental = await equipmentService.updateRentalStatus(req.user!.userId, req.params.id, result.data.status)
    return sendSuccess(res, rental)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// PATCH /api/equipment/:id/rent-settings  Body: { isForRent, pricePerDayCents? }
router.patch('/:id/rent-settings', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({
    isForRent: z.boolean(),
    pricePerDayCents: z.number().int().positive().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'isForRent requerido', 422)

  try {
    const equipment = await equipmentService.setRentalSettings(req.user!.userId, req.params.id, result.data)
    return sendSuccess(res, equipment)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

export default router
