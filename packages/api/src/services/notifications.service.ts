import webpush from 'web-push'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'

// ─── VAPID Setup ─────────────────────────────────────────────────────────────

export const isWebPushConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)

if (isWebPushConfigured) {
  webpush.setVapidDetails(
    env.VAPID_EMAIL,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  )
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  })
}

export async function removePushSubscription(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } })
}

// ─── Send to user ─────────────────────────────────────────────────────────────

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
  tag?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isWebPushConfigured) {
    console.log(`[Push] Not configured — would send to ${userId}:`, payload.title)
    return
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const notification = JSON.stringify({
    ...payload,
    icon: payload.icon ?? '/icon-192.png',
    badge: payload.badge ?? '/badge-72.png',
  })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification,
      ),
    ),
  )

  // Remove expired / invalid subscriptions
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { endpoint: subs[i].endpoint } }).catch(() => {})
      }
    }
  }
}

// ─── Domain-specific push helpers ────────────────────────────────────────────

export async function notifyRequestMatched(clientUserId: string, workerName: string, requestId: string) {
  return sendPushToUser(clientUserId, {
    title: '¡Profesional encontrado! 🎉',
    body: `${workerName} aceptó tu pedido y está en camino.`,
    tag: `request-matched-${requestId}`,
    data: { url: `/requests/${requestId}/tracking` },
  })
}

export async function notifyIncomingRequest(
  workerUserId: string,
  categoryName: string,
  distanceKm: number,
) {
  return sendPushToUser(workerUserId, {
    title: `Nuevo pedido: ${categoryName} 📬`,
    body: `A ${distanceKm} km de tu ubicación. ¡Aceptá rápido!`,
    tag: 'incoming-request',
    data: { url: '/requests/incoming' },
  })
}

export async function notifyPaymentApproved(clientUserId: string, amount: number, requestId: string) {
  const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount)
  return sendPushToUser(clientUserId, {
    title: 'Pago confirmado ✅',
    body: `Tu pago de ${formatted} fue aprobado. Buscando profesional...`,
    tag: `payment-${requestId}`,
    data: { url: `/requests/${requestId}/searching` },
  })
}

export async function notifySubscriptionGenerated(clientUserId: string, categoryName: string, requestId: string) {
  return sendPushToUser(clientUserId, {
    title: `Servicio programado 🔄`,
    body: `Tu suscripción de ${categoryName} está activa para hoy. Buscando profesional...`,
    tag: `sub-${requestId}`,
    data: { url: `/requests/${requestId}/searching` },
  })
}

export async function notifyRequestCompleted(clientUserId: string, requestId: string) {
  return sendPushToUser(clientUserId, {
    title: '¡Servicio completado! ⭐',
    body: 'Contanos cómo fue tu experiencia.',
    tag: `completed-${requestId}`,
    data: { url: `/requests/${requestId}/review` },
  })
}
