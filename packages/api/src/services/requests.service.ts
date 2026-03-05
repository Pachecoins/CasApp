import { prisma } from '../config/prisma.js'
import { calculatePrice, isNighttimeRequest } from '@casapp/shared'
import type { ServiceType, SubscriptionFrequency } from '@casapp/shared'
import { io } from '../index.js'

const ON_DEMAND_EXPIRY_MS = 5 * 60 * 1000 // 5 min antes de ampliar radio
const ON_DEMAND_NOTIFY_COUNT = 3 // notificar a los 3 más cercanos

interface CreateRequestParams {
  clientUserId: string
  categoryId: string
  type: ServiceType
  address: string
  latitude: number
  longitude: number
  description?: string
  scheduledAt?: string
  estimatedDuration?: number
}

export async function createRequest(params: CreateRequestParams) {
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: params.clientUserId },
  })
  if (!clientProfile) throw new Error('Perfil de cliente no encontrado')

  const category = await prisma.serviceCategory.findUnique({
    where: { id: params.categoryId },
  })
  if (!category) throw new Error('Categoría no encontrada')

  // Calcular precio estimado
  const isNight = isNighttimeRequest()
  const distKm = 0 // se recalcula cuando se asigna trabajador
  const priceBreakdown = calculatePrice({
    basePrice: params.type === 'SCHEDULED' ? category.scheduledPrice : category.basePrice,
    type: params.type,
    distanceKm: distKm,
    isNighttime: isNight,
  })

  const request = await prisma.serviceRequest.create({
    data: {
      clientId: clientProfile.id,
      categoryId: params.categoryId,
      type: params.type,
      // ON_DEMAND and SCHEDULED go to PENDING_PAYMENT; matching starts after payment
      status: params.type === 'SUBSCRIPTION' ? 'PENDING' : 'PENDING_PAYMENT',
      address: params.address,
      latitude: params.latitude,
      longitude: params.longitude,
      description: params.description,
      scheduledAt: params.scheduledAt ? new Date(params.scheduledAt) : undefined,
      estimatedDuration: params.estimatedDuration,
      finalPrice: priceBreakdown.total,
    },
    include: {
      category: true,
      client: {
        include: { user: { select: { firstName: true, lastName: true, phone: true } } },
      },
    },
  })

  return request
}

// Exported so payments.service can trigger matching after payment approval
export async function notifyNearbyWorkersExport(
  requestId: string,
  lat: number,
  lng: number,
  categoryId: string,
  radiusKm = 15,
) {
  return notifyNearbyWorkers(requestId, lat, lng, categoryId, radiusKm)
}

async function notifyNearbyWorkers(
  requestId: string,
  lat: number,
  lng: number,
  categoryId: string,
  radiusKm = 15,
) {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))

  const workers = await prisma.workerProfile.findMany({
    where: {
      isAvailable: true,
      currentLatitude: { gte: lat - latDelta, lte: lat + latDelta },
      currentLongitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      workerServices: { some: { categoryId, isActive: true } },
    },
    include: {
      user: { select: { id: true } },
    },
    orderBy: [
      { currentLatitude: 'asc' }, // approximate sort; precise handled in app layer
    ],
    take: ON_DEMAND_NOTIFY_COUNT,
  })

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      client: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  })

  if (!request) return

  const expiresAt = new Date(Date.now() + ON_DEMAND_EXPIRY_MS).toISOString()

  // Emitir evento Socket.io a cada trabajador disponible
  for (const worker of workers) {
    io.to(`worker:${worker.userId}`).emit('worker:incoming-request', {
      request,
      expiresAt,
    })
  }

  // Programar ampliación de radio si nadie acepta en 5 min
  setTimeout(async () => {
    const current = await prisma.serviceRequest.findUnique({ where: { id: requestId } })
    if (current?.status === 'PENDING') {
      await notifyNearbyWorkers(requestId, lat, lng, categoryId, radiusKm + 10)
    }
  }, ON_DEMAND_EXPIRY_MS)
}

export async function acceptRequest(requestId: string, workerUserId: string) {
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId: workerUserId },
  })
  if (!workerProfile) throw new Error('Perfil de trabajador no encontrado')

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { category: true },
  })
  if (!request) throw new Error('Pedido no encontrado')
  if (request.status !== 'PENDING') throw new Error('Este pedido ya no está disponible')

  // Calcular precio final con distancia real
  const distKm = workerProfile.currentLatitude
    ? Math.sqrt(
        Math.pow(request.latitude - workerProfile.currentLatitude, 2) +
          Math.pow(request.longitude - (workerProfile.currentLongitude ?? 0), 2),
      ) * 111
    : 0

  const isNight = isNighttimeRequest()
  const basePrice =
    request.type === 'SCHEDULED' ? request.category.scheduledPrice : request.category.basePrice
  const priceBreakdown = calculatePrice({
    basePrice,
    type: request.type as ServiceType,
    frequency: undefined,
    distanceKm: distKm,
    isNighttime: isNight,
  })

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      workerId: workerProfile.id,
      status: 'MATCHED',
      finalPrice: priceBreakdown.total,
    },
    include: {
      worker: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } } } },
      client: { include: { user: { select: { firstName: true, lastName: true } } } },
      category: true,
    },
  })

  // Notificar al cliente
  io.to(`client:${updated.client.userId}`).emit('request:status-change', {
    requestId,
    status: 'MATCHED',
    worker: updated.worker,
    updatedAt: updated.updatedAt.toISOString(),
  })

  return updated
}

export async function rejectRequest(requestId: string, workerUserId: string) {
  // En MVP simplemente se ignora; en v2 se llevaría registro de rechazos
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId: workerUserId },
  })
  if (!workerProfile) throw new Error('Perfil no encontrado')

  // Notificar al siguiente trabajador disponible (expansión simple)
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } })
  if (request?.status === 'PENDING') {
    // Re-emitir a otros trabajadores cercanos (se maneja en notifyNearbyWorkers timeout)
    io.to(`request:${requestId}`).emit('request:worker-rejected', { workerId: workerProfile.id })
  }

  return { ok: true }
}

export async function updateRequestStatus(
  requestId: string,
  userId: string,
  newStatus: string,
  role: string,
) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      client: true,
      worker: true,
    },
  })
  if (!request) throw new Error('Pedido no encontrado')

  // Validar permisos
  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } })
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } })

  const isOwnerClient = clientProfile?.id === request.clientId
  const isOwnerWorker = workerProfile?.id === request.workerId
  const isAdmin = role === 'ADMIN'

  if (!isOwnerClient && !isOwnerWorker && !isAdmin) {
    throw new Error('Sin permisos para modificar este pedido')
  }

  // Validar transiciones de estado
  const allowedTransitions: Record<string, string[]> = {
    MATCHED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
    PENDING: ['CANCELLED'],
  }

  const allowed = allowedTransitions[request.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`No se puede pasar de ${request.status} a ${newStatus}`)
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status: newStatus as never },
    include: { category: true, worker: true, client: true },
  })

  // Emitir cambio de estado en tiempo real
  io.to(`request:${requestId}`).emit('request:status-change', {
    requestId,
    status: newStatus,
    updatedAt: updated.updatedAt.toISOString(),
  })

  return updated
}

export async function getClientRequests(clientUserId: string) {
  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: clientUserId } })
  if (!clientProfile) throw new Error('Perfil de cliente no encontrado')

  return prisma.serviceRequest.findMany({
    where: { clientId: clientProfile.id },
    include: {
      category: true,
      worker: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      },
      review: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getWorkerRequests(workerUserId: string) {
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!workerProfile) throw new Error('Perfil de trabajador no encontrado')

  return prisma.serviceRequest.findMany({
    where: { workerId: workerProfile.id },
    include: {
      category: true,
      client: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } } },
      },
      review: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRequestById(requestId: string, userId: string, role: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      client: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } } },
      },
      worker: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } } },
      },
      review: true,
      transactions: true,
    },
  })

  if (!request) throw new Error('Pedido no encontrado')

  // Verificar acceso
  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } })
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } })
  const isAdmin = role === 'ADMIN'

  if (
    !isAdmin &&
    clientProfile?.id !== request.clientId &&
    workerProfile?.id !== request.workerId
  ) {
    throw new Error('Sin acceso a este pedido')
  }

  return request
}
