import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router = Router()

// GET /api/categories
router.get('/', async (_req, res) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return sendSuccess(res, categories)
  } catch {
    return sendError(res, 'Error al obtener categorías', 500)
  }
})

// GET /api/categories/:slug
router.get('/:slug', async (req, res) => {
  try {
    const category = await prisma.serviceCategory.findUnique({
      where: { slug: req.params.slug },
    })
    if (!category) return sendError(res, 'Categoría no encontrada', 404)
    return sendSuccess(res, category)
  } catch {
    return sendError(res, 'Error al obtener categoría', 500)
  }
})

export default router
