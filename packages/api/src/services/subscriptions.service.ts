import { prisma } from '../config/prisma.js'
import type { SubscriptionFrequency } from '@casapp/shared'
import { notifyNearbyWorkersExport } from './requests.service.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextOccurrence(dayOfWeek: number, timeSlot: string, from: Date = new Date()): Date {
  const [hours, minutes] = timeSlot.split(':').map(Number)
  const next = new Date(from)
  next.setHours(hours, minutes, 0, 0)

  const daysUntil = (dayOfWeek - next.getDay() + 7) % 7
  if (daysUntil === 0 && next <= from) {
    next.setDate(next.getDate() + 7)
  } else {
    next.setDate(next.getDate() + daysUntil)
  }
  return next
}

function getFrequencyDays(freq: SubscriptionFrequency): number {
  return freq === 'WEEKLY' ? 7 : freq === 'BIWEEKLY' ? 14 : 30
}

const FREQ_MULTIPLIERS: Record<SubscriptionFrequency, number> = {
  WEEKLY: 0.75,
  BIWEEKLY: 0.80,
  MONTHLY: 0.85,
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateSubscriptionParams {
  clientUserId: string
  categoryId: string
  frequency: SubscriptionFrequency
  dayOfWeek: number
  timeSlot: string
  address: string
  latitude: number
  longitude: number
  preferSameWorker?: boolean
  description?: string
}

export async function createSubscription(params: CreateSubscriptionParams) {
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: params.clientUserId },
  })
  if (!clientProfile) throw new Error('Perfil de cliente no encontrado')

  const category = await prisma.serviceCategory.findUnique({
    where: { id: params.categoryId },
    select: { id: true, name: true, basePriceStandard: true },
  })
  if (!category) throw new Error('Categoría no encontrada')

  const multiplier = FREQ_MULTIPLIERS[params.frequency] ?? 1
  const pricePerVisit = Math.round(category.basePriceStandard * multiplier)

  const nextServiceDate = getNextOccurrence(params.dayOfWeek, params.timeSlot)

  const subscription = await prisma.subscription.create({
    data: {
      clientId: clientProfile.id,
      categoryId: params.categoryId,
      frequency: params.frequency,
      dayOfWeek: params.dayOfWeek,
      timeSlot: params.timeSlot,
      preferSameWorker: params.preferSameWorker ?? false,
      pricePerVisit,
      address: params.address,
      latitude: params.latitude,
      longitude: params.longitude,
      description: params.description,
      nextServiceDate,
      isActive: true,
    },
    include: {
      category: { select: { name: true, slug: true } },
      worker: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      },
    },
  })

  return subscription
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function getClientSubscriptions(clientUserId: string) {
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: clientUserId },
  })
  if (!clientProfile) throw new Error('Perfil de cliente no encontrado')

  return prisma.subscription.findMany({
    where: { clientId: clientProfile.id },
    include: {
      category: { select: { name: true, slug: true } },
      worker: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      },
    },
    orderBy: [{ isActive: 'desc' }, { nextServiceDate: 'asc' }],
  })
}

// ─── Get by id ────────────────────────────────────────────────────────────────

export async function getSubscriptionById(subscriptionId: string, userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      category: true,
      worker: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } } },
      },
      client: {
        include: { user: { select: { id: true } } },
      },
    },
  })
  if (!subscription) throw new Error('Suscripción no encontrada')

  if (subscription.client.user.id !== userId) throw new Error('Acceso denegado')

  return subscription
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateSubscription(
  subscriptionId: string,
  clientUserId: string,
  data: Partial<{ dayOfWeek: number; timeSlot: string; preferSameWorker: boolean }>,
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { client: { include: { user: { select: { id: true } } } } },
  })
  if (!subscription) throw new Error('Suscripción no encontrada')
  if (subscription.client.user.id !== clientUserId) throw new Error('Acceso denegado')
  if (!subscription.isActive) throw new Error('La suscripción no está activa')

  const dayOfWeek = data.dayOfWeek ?? subscription.dayOfWeek
  const timeSlot = data.timeSlot ?? subscription.timeSlot

  const nextServiceDate =
    data.dayOfWeek !== undefined || data.timeSlot !== undefined
      ? getNextOccurrence(dayOfWeek, timeSlot)
      : undefined

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      ...(data.dayOfWeek !== undefined && { dayOfWeek }),
      ...(data.timeSlot !== undefined && { timeSlot }),
      ...(data.preferSameWorker !== undefined && { preferSameWorker: data.preferSameWorker }),
      ...(nextServiceDate && { nextServiceDate }),
    },
    include: {
      category: { select: { name: true, slug: true } },
      worker: {
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      },
    },
  })
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelSubscription(subscriptionId: string, clientUserId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { client: { include: { user: { select: { id: true } } } } },
  })
  if (!subscription) throw new Error('Suscripción no encontrada')
  if (subscription.client.user.id !== clientUserId) throw new Error('Acceso denegado')

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { isActive: false, cancelledAt: new Date() },
  })
}

// ─── Cron: generate recurring service requests ────────────────────────────────

export async function generateScheduledRequests() {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000) // next 60 min

  const ACTIVE_STATUSES = ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'FINISHED_PENDING_APPROVAL']

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      nextServiceDate: { lte: windowEnd },
    },
    include: {
      category: { select: { id: true, basePriceStandard: true } },
      client: {
        include: {
          user: { select: { id: true } },
          serviceRequests: {
            where: { status: { in: ACTIVE_STATUSES } },
            select: { id: true },
            take: 1,
          },
        },
      },
      worker: {
        include: { user: { select: { id: true } } },
      },
    },
  })

  console.log(`[Cron] Processing ${dueSubscriptions.length} due subscription(s)`)

  for (const sub of dueSubscriptions) {
    // Skip if client already has an active request
    if (sub.client.serviceRequests.length > 0) continue

    // Skip subscriptions without location data
    if (!sub.latitude || !sub.longitude || !sub.address) continue

    try {
      const quotedPrice = sub.pricePerVisit // already stored at subscription creation

      // Prefer same worker if configured and available
      let preferredWorkerId: string | undefined
      if (sub.preferSameWorker && sub.workerId) {
        const workerProfile = await prisma.workerProfile.findUnique({
          where: { id: sub.workerId },
          select: { isAvailable: true },
        })
        if (workerProfile?.isAvailable) {
          preferredWorkerId = sub.workerId
        }
      }

      const request = await prisma.serviceRequest.create({
        data: {
          clientId: sub.clientId,
          categoryId: sub.categoryId,
          status: 'SEARCHING',
          address: sub.address,
          latitude: sub.latitude,
          longitude: sub.longitude,
          quotedPrice,
          platformFeePercent: 15,
          workerId: preferredWorkerId,
          scheduledAt: sub.nextServiceDate ?? undefined,
          description: sub.description ?? undefined,
        },
      })

      // Advance next occurrence
      const freqDays = getFrequencyDays(sub.frequency as SubscriptionFrequency)
      const nextDate = new Date(sub.nextServiceDate ?? now)
      nextDate.setDate(nextDate.getDate() + freqDays)

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          nextServiceDate: nextDate,
          ...(preferredWorkerId ? {} : { workerId: null }),
        },
      })

      // Trigger worker matching (payment will be charged separately or inline)
      if (!preferredWorkerId) {
        notifyNearbyWorkersExport(request.id).catch(console.error)
      }

      console.log(`[Cron] Created subscription request ${request.id} for sub ${sub.id}`)
    } catch (err) {
      console.error(`[Cron] Error processing subscription ${sub.id}:`, err)
    }
  }
}
