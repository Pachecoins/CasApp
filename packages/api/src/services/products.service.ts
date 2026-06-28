import { prisma } from '../config/prisma.js'
import { calculateDistance } from '@casapp/shared'
import { uploadDocument } from './kyc.service.js'

interface BrowseParams {
  lat?: number
  lng?: number
  radius?: number
}

export async function browseProducts(params: BrowseParams) {
  const { lat, lng, radius = 30 } = params

  const products = await prisma.workerProduct.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    include: {
      worker: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (lat == null || lng == null) return products.map((p) => ({ ...p, distanceKm: null }))

  return products
    .map((p) => {
      const distanceKm =
        p.worker.currentLatitude != null && p.worker.currentLongitude != null
          ? Math.round(calculateDistance(lat, lng, p.worker.currentLatitude, p.worker.currentLongitude) * 10) / 10
          : null
      return { ...p, distanceKm }
    })
    .filter((p) => p.distanceKm == null || p.distanceKm <= radius)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
}

export async function getOwnProducts(workerUserId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.workerProduct.findMany({ where: { workerId: worker.id }, orderBy: { createdAt: 'desc' } })
}

export async function createProduct(
  workerUserId: string,
  data: { name: string; description?: string; photoBase64: string; priceCents: number; stock: number },
) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  const photoUrl = await uploadDocument(data.photoBase64, worker.id, 'product')

  return prisma.workerProduct.create({
    data: {
      workerId: worker.id,
      name: data.name,
      description: data.description,
      photoUrl,
      priceCents: data.priceCents,
      stock: data.stock,
    },
  })
}

export async function updateProduct(
  workerUserId: string,
  productId: string,
  data: { isActive?: boolean; priceCents?: number; stock?: number },
) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  const product = await prisma.workerProduct.findUnique({ where: { id: productId } })
  if (!product || product.workerId !== worker.id) throw new Error('Producto no encontrado')

  return prisma.workerProduct.update({ where: { id: productId }, data })
}

export async function createOrder(buyerId: string, data: { productId: string; quantity: number }) {
  const product = await prisma.workerProduct.findUnique({ where: { id: data.productId } })
  if (!product || !product.isActive) throw new Error('Producto no disponible')
  if (product.stock < data.quantity) throw new Error('No hay suficiente stock')

  const totalPriceCents = product.priceCents * data.quantity

  return prisma.$transaction(async (tx) => {
    await tx.workerProduct.update({
      where: { id: product.id },
      data: { stock: { decrement: data.quantity } },
    })

    return tx.productOrder.create({
      data: {
        productId: product.id,
        buyerId,
        quantity: data.quantity,
        totalPriceCents,
      },
      include: { product: true },
    })
  })
}

export async function getMyOrders(buyerId: string) {
  return prisma.productOrder.findMany({
    where: { buyerId },
    include: { product: { include: { worker: { include: { user: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOwnerOrders(workerUserId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.productOrder.findMany({
    where: { product: { workerId: worker.id } },
    include: { product: true, buyer: { select: { firstName: true, lastName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateOrderStatus(
  workerUserId: string,
  orderId: string,
  status: 'CONFIRMED' | 'DELIVERED' | 'CANCELLED',
) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  const order = await prisma.productOrder.findUnique({ where: { id: orderId }, include: { product: true } })
  if (!order || order.product.workerId !== worker.id) throw new Error('Pedido no encontrado')

  if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
    await prisma.workerProduct.update({
      where: { id: order.productId },
      data: { stock: { increment: order.quantity } },
    })
  }

  return prisma.productOrder.update({ where: { id: orderId }, data: { status } })
}
