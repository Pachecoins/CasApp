import { prisma } from '../config/prisma.js'
import { calculateQuote } from '@tuki/shared/utils/price.js'
import { io } from '../index.js'
import {
  notifyRequestMatched,
  notifyIncomingRequest,
  notifyRequestCompleted,
} from './notifications.service.js'
import {
  buildNotificationQueue,
  validateWorkerEligibility,
} from './matching.service.js'

const ACCEPT_EXPIRY_MS = 30_000  // 30 s per worker before moving to next
const EXPAND_AFTER_MS  = 5 * 60_000 // expand radius after 5 min with no accept

interface CreateRequestParams {
  clientUserId: string
  categoryId: string
  address: string
  latitude: number
  longitude: number
  isGatedCommunity?: boolean
  lotSize?: 'SMALL' | 'MEDIUM' | 'LARGE'
  lotAreaM2?: number
  addons?: string[]
  equipmentTier?: 'STANDARD' | 'PREMIUM'
  description?: string
  scheduledAt?: string
}

export async function createRequest(params: CreateRequestParams) {
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: params.clientUserId },
  })
  if (!clientProfile) throw new Error('Perfil de cliente no encontrado')

  const category = await prisma.serviceCategory.findUnique({
    where: { id: params.categoryId },
    select: {
      id: true,
      name: true,
      basePriceStandard: true,
      basePricePremium: true,
      pricePerM2Standard: true,
      pricePerM2Premium: true,
      addonDefinitions: true,
    },
  })
  if (!category) throw new Error('Categoría no encontrada')

  const tier = params.equipmentTier ?? 'STANDARD'
  const lotSize = params.lotSize ?? 'SMALL'

  const quote = calculateQuote(
    {
      basePriceStandard: category.basePriceStandard,
      basePricePremium: category.basePricePremium,
      pricePerM2Standard: category.pricePerM2Standard,
      pricePerM2Premium: category.pricePerM2Premium,
      addonDefinitions: category.addonDefinitions as never,
    },
    {
      lotSize,
      lotAreaM2: params.lotAreaM2,
      selectedAddons: params.addons ?? [],
      equipmentTier: tier,
    },
  )

  const request = await prisma.serviceRequest.create({
    data: {
      clientId: clientProfile.id,
      categoryId: params.categoryId,
      status: 'SEARCHING',
      address: params.address,
      latitude: params.latitude,
      longitude: params.longitude,
      lotSize,
      lotAreaM2: params.lotAreaM2,
      addons: params.addons ?? [],
      isGatedCommunity: params.isGatedCommunity ?? false,
      quotedPrice: quote.total,
      platformFeePercent: 15,
      description: params.description,
      scheduledAt: params.scheduledAt ? new Date(params.scheduledAt) : undefined,
      estimatedDuration: quote.estimatedDurationMin,
    },
    include: {
      category: true,
      client: {
        include: { user: { select: { firstName: true, lastName: true, phone: true } } },
      },
    },
  })

  return { request, quote }
}

// Called by payments.service after payment is captured in escrow
export async function startMatchingAfterPayment(
  requestId: string,
  isGatedCommunity = false,
) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      categoryId: true,
      status: true,
    },
  })
  if (!request || request.status !== 'SEARCHING') return

  await broadcastToWorkers(
    request.id,
    request.latitude,
    request.longitude,
    request.categoryId,
    isGatedCommunity,
  )
}

// Keep old export name for backwards compat with payments.service.ts
export const notifyNearbyWorkersExport = startMatchingAfterPayment

async function broadcastToWorkers(
  requestId: string,
  lat: number,
  lng: number,
  categoryId: string,
  isGatedCommunity: boolean,
  radiusKm = 15,
) {
  const workerUserIds = await buildNotificationQueue(
    { categoryId, latitude: lat, longitude: lng, isGatedCommunity, maxRadiusKm: radiusKm },
  )

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

  const expiresAt = new Date(Date.now() + ACCEPT_EXPIRY_MS).toISOString()

  for (const userId of workerUserIds) {
    io.to(`worker:${userId}`).emit('worker:incoming-request', { request, expiresAt })
    notifyIncomingRequest(userId, request.category.name, 0).catch(() => {})
  }

  // Expand radius if nobody accepts within 5 min
  setTimeout(async () => {
    const current = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    })
    if (current?.status === 'SEARCHING') {
      await broadcastToWorkers(requestId, lat, lng, categoryId, isGatedCommunity, radiusKm + 10)
    }
  }, EXPAND_AFTER_MS)
}

export async function acceptRequest(requestId: string, workerUserId: string) {
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId: workerUserId },
    select: {
      id: true,
      currentLatitude: true,
      currentLongitude: true,
      insuranceVerified: true,
    },
  })
  if (!workerProfile) throw new Error('Perfil de trabajador no encontrado')

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { category: true, client: { include: { user: true } } },
  })
  if (!request) throw new Error('Pedido no encontrado')
  if (request.status !== 'SEARCHING') throw new Error('Este pedido ya no está disponible')

  // Re-validate eligibility at accept time (gated community + radius)
  // We don't have isGatedCommunity on the request yet; derive from client addresses
  const defaultAddress = await prisma.clientAddress.findFirst({
    where: { clientId: request.clientId, isDefault: true },
  })
  const isGatedCommunity = defaultAddress?.isGatedCommunity ?? false

  const eligibility = await validateWorkerEligibility(workerProfile.id, {
    categoryId: request.categoryId,
    latitude: request.latitude,
    longitude: request.longitude,
    isGatedCommunity,
  })
  if (!eligibility.eligible) throw new Error(eligibility.reason)

  // Atomic update — only one worker wins the race
  const updated = await prisma.serviceRequest.updateMany({
    where: { id: requestId, status: 'SEARCHING' },
    data: { workerId: workerProfile.id, status: 'ASSIGNED' },
  })
  if (updated.count === 0) throw new Error('Este pedido ya fue tomado por otro trabajador')

  const full = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      worker: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } } } },
      client: { include: { user: { select: { firstName: true, lastName: true } } } },
      category: true,
    },
  })

  // Notify client in real-time
  io.to(`client:${full!.client.userId}`).emit('request:status-change', {
    requestId,
    status: 'ASSIGNED',
    worker: full!.worker,
    updatedAt: full!.updatedAt.toISOString(),
  })
  notifyRequestMatched(
    full!.client.userId,
    `${full!.worker!.user.firstName} ${full!.worker!.user.lastName}`,
    requestId,
  ).catch(() => {})

  return full
}

export async function rejectRequest(requestId: string, workerUserId: string) {
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!workerProfile) throw new Error('Perfil no encontrado')
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { status: true } })
  if (request?.status === 'SEARCHING') {
    io.to(`request:${requestId}`).emit('request:worker-rejected', { workerId: workerProfile.id })
  }
  return { ok: true }
}

// ─── STATE MACHINE ────────────────────────────────────────────────────────────

const WORKER_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED:                  ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE:                  ['IN_PROGRESS'],
  IN_PROGRESS:               ['FINISHED_PENDING_APPROVAL'],
}

const CLIENT_TRANSITIONS: Record<string, string[]> = {
  SEARCHING:                 ['CANCELLED'],
  ASSIGNED:                  ['CANCELLED'],
  FINISHED_PENDING_APPROVAL: ['COMPLETED', 'DISPUTED'],
}

const ADMIN_EXTRA: Record<string, string[]> = {
  DISPUTED: ['COMPLETED', 'CANCELLED'],
}

export async function updateRequestStatus(
  requestId: string,
  userId: string,
  newStatus: string,
  role: string,
  extras?: { completionPhotoUrl?: string },
) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { client: true, worker: true },
  })
  if (!request) throw new Error('Pedido no encontrado')

  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } })
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } })
  const isAdmin = role === 'ADMIN'
  const isOwnerClient = clientProfile?.id === request.clientId
  const isOwnerWorker = workerProfile?.id === request.workerId

  if (!isOwnerClient && !isOwnerWorker && !isAdmin) {
    throw new Error('Sin permisos para modificar este pedido')
  }

  // Determine allowed transitions based on who's calling
  let allowed: string[] = []
  if (isOwnerWorker) allowed = WORKER_TRANSITIONS[request.status] ?? []
  if (isOwnerClient) allowed = [...allowed, ...(CLIENT_TRANSITIONS[request.status] ?? [])]
  if (isAdmin)       allowed = [...allowed, ...(ADMIN_EXTRA[request.status] ?? [])]

  if (!allowed.includes(newStatus)) {
    throw new Error(`No se puede pasar de ${request.status} a ${newStatus}`)
  }

  // Worker must provide completion photo when finishing
  if (newStatus === 'FINISHED_PENDING_APPROVAL' && !extras?.completionPhotoUrl) {
    throw new Error('Se requiere la foto del trabajo terminado para finalizar')
  }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'FINISHED_PENDING_APPROVAL') {
    updateData.completionPhotoUrl = extras!.completionPhotoUrl
    updateData.finishedAt = new Date()
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: updateData as never,
    include: { category: true, worker: true, client: true },
  })

  io.to(`request:${requestId}`).emit('request:status-change', {
    requestId,
    status: newStatus,
    updatedAt: updated.updatedAt.toISOString(),
    completionPhotoUrl: updated.completionPhotoUrl,
  })

  if (newStatus === 'COMPLETED') {
    notifyRequestCompleted(updated.client.userId, requestId).catch(() => {})
  }

  return updated
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

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

  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } })
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } })
  const isAdmin = role === 'ADMIN'

  if (!isAdmin && clientProfile?.id !== request.clientId && workerProfile?.id !== request.workerId) {
    throw new Error('Sin acceso a este pedido')
  }

  return request
}
