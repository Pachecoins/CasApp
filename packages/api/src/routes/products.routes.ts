import { Router } from 'express'
import { z } from 'zod'
import * as productsService from '../services/products.service.js'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// GET /api/products?lat=&lng=&radius=
router.get('/', async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(200).default(30),
  })
  const result = schema.safeParse(req.query)
  if (!result.success) return sendError(res, 'Parámetros inválidos', 422)

  try {
    const products = await productsService.browseProducts(result.data)
    return sendSuccess(res, products)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// GET /api/products/me  (worker's own products)
router.get('/me', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const products = await productsService.getOwnProducts(req.user!.userId)
    return sendSuccess(res, products)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// POST /api/products  Body: { name, description?, photoBase64, priceCents, stock }
router.post('/', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(300).optional(),
    photoBase64: z.string().min(100),
    priceCents: z.number().int().positive(),
    stock: z.number().int().min(0),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos del producto inválidos', 422, result.error.flatten())

  try {
    const product = await productsService.createProduct(req.user!.userId, result.data)
    return sendSuccess(res, product, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al crear producto', 400)
  }
})

// PATCH /api/products/:id  Body: { isActive?, priceCents?, stock? }
router.patch('/:id', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({
    isActive: z.boolean().optional(),
    priceCents: z.number().int().positive().optional(),
    stock: z.number().int().min(0).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'Datos inválidos', 422)

  try {
    const product = await productsService.updateProduct(req.user!.userId, req.params.id, result.data)
    return sendSuccess(res, product)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// GET /api/products/me/orders  (worker's incoming orders)
router.get('/me/orders', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  try {
    const orders = await productsService.getOwnerOrders(req.user!.userId)
    return sendSuccess(res, orders)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

// PATCH /api/products/orders/:id/status  Body: { status }
router.patch('/orders/:id/status', authenticate, requireRole('WORKER'), async (req: AuthRequest, res) => {
  const schema = z.object({ status: z.enum(['CONFIRMED', 'DELIVERED', 'CANCELLED']) })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'status inválido', 422)

  try {
    const order = await productsService.updateOrderStatus(req.user!.userId, req.params.id, result.data.status)
    return sendSuccess(res, order)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 400)
  }
})

// POST /api/products/orders  Body: { productId, quantity }
router.post('/orders', authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({ productId: z.string(), quantity: z.number().int().positive() })
  const result = schema.safeParse(req.body)
  if (!result.success) return sendError(res, 'productId y quantity requeridos', 422)

  try {
    const order = await productsService.createOrder(req.user!.userId, result.data)
    return sendSuccess(res, order, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error al crear pedido', 400)
  }
})

// GET /api/products/orders/mine  (buyer's own orders)
router.get('/orders/mine', authenticate, async (req: AuthRequest, res) => {
  try {
    const orders = await productsService.getMyOrders(req.user!.userId)
    return sendSuccess(res, orders)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Error', 500)
  }
})

export default router
