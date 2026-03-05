import { prisma } from '../config/prisma.js'
import { calculatePrice } from '@casapp/shared'
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
  })
  if (!category) throw new Error('Categoría no encontrada')

  const priceBreakdown = calculatePrice({
    basePrice: category.scheduledPrice,
    type: 'SUBSCRIPTION',
    frequency: params.frequency,
  })

  const nextServiceDate = getNextOccurrence(params.dayOfWeek, params.timeSlot)

  const subscription = await prisma.subscription.create({
    data: {
      clientId: clientProfile.id,
      categoryId: params.categoryId,
      frequency: params.frequency,
      dayOfWeek: params.dayOfWeek,
      timeSlot: params.timeSlot,
      preferSameWorker: params.preferSameWorker ?? false,
      pricePerVisit: priceBreakdown.total,
      nextServiceDate,
      isActive: true,
    },
    include: {
      category: { select: { name: true, slug: true, basePrice: true, scheduledPrice: true } },
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

  // access control — only the client who owns it
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

  // Recalculate next service date if day/time changed
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

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      nextServiceDate: { lte: windowEnd },
    },
    include: {
      category: true,
      client: {
        include: {
          user: { select: { id: true } },
          serviceRequests: {
            where: { status: { in: ['PENDING_PAYMENT', 'PENDING', 'MATCHED', 'CONFIRMED', 'IN_PROGRESS'] } },
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
    // Skip if client already has an active request right now
    if (sub.client.serviceRequests.length > 0) continue

    try {
      const priceBreakdown = calculatePrice({
        basePrice: sub.category.scheduledPrice,
        type: 'SUBSCRIPTION',
        frequency: sub.frequency as SubscriptionFrequency,
      })

      // Prefer same worker if configured and available
      let preferredWorkerId: string | undefined
      if (sub.preferSameWorker && sub.workerId) {
        const workerProfile = await prisma.workerProfile.findUnique({
          where: { id: sub.workerId },
        })
        if (workerProfile?.isAvailable) {
          preferredWorkerId = sub.workerId
        }
      }

      const clientProfile = await prisma.clientProfile.findUnique({
        where: { userId: sub.client.user.id },
        select: { id: true, address: true, latitude: true, longitude: true },
      })
      if (!clientProfile?.latitude || !clientProfile?.longitude) continue

      // Create the service request for this subscription cycle
      const request = await prisma.serviceRequest.create({
        data: {
          clientId: clientProfile.id,
          categoryId: sub.categoryId,
          type: 'SUBSCRIPTION',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          address: clientProfile.address ?? '',
          latitude: clientProfile.latitude,
          longitude: clientProfile.longitude,
          finalPrice: priceBreakdown.total,
          workerId: preferredWorkerId,
          scheduledAt: sub.nextServiceDate ?? undefined,
        },
      })

      // Calculate next occurrence based on frequency
      const freqDays = getFrequencyDays(sub.frequency as SubscriptionFrequency)
      const nextDate = new Date(sub.nextServiceDate ?? now)
      nextDate.setDate(nextDate.getDate() + freqDays)

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          nextServiceDate: nextDate,
          ...(preferredWorkerId ? {} : { workerId: null }), // clear preferred if unavailable
        },
      })

      // If no preferred worker assigned, trigger matching
      if (!preferredWorkerId) {
        notifyNearbyWorkersExport(
          request.id,
          clientProfile.latitude,
          clientProfile.longitude,
          sub.categoryId,
        ).catch(console.error)
      }

      console.log(`[Cron] Created subscription request ${request.id} for sub ${sub.id}`)
    } catch (err) {
      console.error(`[Cron] Error processing subscription ${sub.id}:`, err)
    }
  }
}
