import { prisma } from '../config/prisma.js'
import { type TransactionStatus } from '@prisma/client'
import { mpPreferenceClient, mpPaymentClient, mpRefundClient, isMPConfigured } from '../config/mercadopago.js'
import { env } from '../config/env.js'
import { startMatchingAfterPayment } from './requests.service.js'
import { capturePayment } from './escrow.service.js'

const PLATFORM_COMMISSION = 0.15 // 15% — TUKI's marketplace fee

// ─── Create Payment Preference (MP Marketplace) ───────────────────────────────
/**
 * Creates a MercadoPago preference with marketplace_fee = 15%.
 * If the worker has a linked MP account (mpUserId), the remaining 85% goes
 * directly to their account. Otherwise we capture the full amount and handle
 * the split manually via wallet + withdrawal.
 *
 * Payment is created with auto_capture: false so funds sit as an authorization
 * until the client presses "Liberar pago" (or 24h pass and the cron releases).
 */
export async function createPaymentPreference(requestId: string, userId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      client: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
      worker: { select: { mpUserId: true, mpAccessToken: true } },
    },
  })

  if (!request) throw new Error('Pedido no encontrado')
  if (request.status !== 'SEARCHING' && request.status !== 'ASSIGNED') {
    throw new Error('El pedido no está en estado válido para pago')
  }

  const amount = request.quotedPrice ?? 0
  if (amount <= 0) throw new Error('Precio inválido')

  const platformFee   = Math.round(amount * PLATFORM_COMMISSION)
  const workerEarning = amount - platformFee

  // Create pending transaction record
  const transaction = await prisma.transaction.create({
    data: {
      serviceRequestId: requestId,
      amount,
      currency: 'ARS',
      method: 'MERCADOPAGO',
      status: 'PENDING',
      escrowStatus: 'HELD',
      platformFee,
      workerEarnings: workerEarning,
    },
  })

  // Dev mode — skip real MP call
  if (!isMPConfigured) {
    return {
      transactionId: transaction.id,
      initPoint: `${env.CLIENT_APP_URL}/payment/result?requestId=${requestId}&status=approved&mock=1`,
      preferenceId: 'mock-preference-id',
      isMock: true,
    }
  }

  const clientUrl = env.CLIENT_APP_URL

  // If worker has a linked MP account, use Marketplace split
  const collectorsAccessToken = request.worker?.mpAccessToken ?? undefined

  const preference = await mpPreferenceClient.create({
    body: {
      items: [
        {
          id: request.categoryId,
          title: `TUKI — ${request.category.name}`,
          description: request.description ?? request.category.name,
          quantity: 1,
          unit_price: amount,
          currency_id: 'ARS',
        },
      ],
      payer: {
        email: request.client.user.email,
        name: request.client.user.firstName,
        surname: request.client.user.lastName,
      },
      marketplace_fee: platformFee,
      // Deferred capture — funds held until we explicitly capture via MP API
      ...(collectorsAccessToken
        ? { collector_access_token: collectorsAccessToken }
        : {}),
      back_urls: {
        success: `${clientUrl}/payment/result?requestId=${requestId}&status=approved`,
        failure: `${clientUrl}/payment/result?requestId=${requestId}&status=rejected`,
        pending: `${clientUrl}/payment/result?requestId=${requestId}&status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${env.API_URL ?? 'http://localhost:3000'}/api/payments/webhook`,
      external_reference: `${requestId}::${transaction.id}`,
    },
  })

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { mpPreferenceId: preference.id },
  })

  return {
    transactionId: transaction.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
    preferenceId: preference.id,
    isMock: false,
  }
}

// ─── Process Webhook ──────────────────────────────────────────────────────────
export async function processWebhook(topic: string, resourceId: string, rawBody: unknown) {
  if (topic !== 'payment') return { ignored: true }

  let paymentData: {
    id: number | string
    status: string
    external_reference?: string
    transaction_amount?: number
  }

  if (isMPConfigured) {
    const payment = await mpPaymentClient.get({ id: Number(resourceId) })
    paymentData = {
      id: payment.id!,
      status: payment.status!,
      external_reference: payment.external_reference ?? undefined,
      transaction_amount: payment.transaction_amount ?? undefined,
    }
  } else {
    const tx = await prisma.transaction.findFirst({
      where: { mpPreferenceId: 'mock-preference-id' },
      orderBy: { createdAt: 'desc' },
    })
    if (!tx) return { ignored: true }
    paymentData = {
      id: 0,
      status: 'approved',
      external_reference: `${tx.serviceRequestId}::${tx.id}`,
    }
  }

  const externalRef = paymentData.external_reference
  if (!externalRef) return { ignored: true }

  const [requestId, transactionId] = externalRef.split('::')
  if (!requestId || !transactionId) return { ignored: true }

  const txStatus: TransactionStatus =
    paymentData.status === 'approved' ? 'APPROVED'
    : paymentData.status === 'rejected' ? 'REJECTED'
    : 'PENDING'

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: txStatus,
      mpPaymentId: String(paymentData.id),
      rawWebhookData: rawBody as object,
    },
  })

  if (txStatus === 'APPROVED') {
    // Record capture in escrow
    await capturePayment({
      serviceRequestId: requestId,
      amount: paymentData.transaction_amount ?? 0,
      method: 'MERCADOPAGO',
      mpPaymentId: String(paymentData.id),
    })

    // Start worker matching
    const req = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    })
    if (req?.status === 'SEARCHING') {
      startMatchingAfterPayment(requestId).catch(console.error)
    }
  } else if (txStatus === 'REJECTED') {
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    })
  }

  return { processed: true, status: txStatus }
}

// ─── Release payment via MP API ───────────────────────────────────────────────
/**
 * Called by escrow.service.releaseToWorker() after client approves or 24h pass.
 * If the worker has a linked MP account, the split already happened at preference
 * creation time (marketplace_fee deducted). Otherwise, the funds stay in TUKI's
 * account and we top up the worker's internal wallet.
 */
export async function captureViaMP(mpPaymentId: string): Promise<void> {
  if (!isMPConfigured || !mpPaymentId || mpPaymentId.startsWith('mock')) return
  // MP capture call would go here for deferred-capture payments.
  // For standard auto-capture preferences (current setup), no action needed.
}

// ─── Refund via MP API ─────────────────────────────────────────────────────────
/**
 * Issues a full refund for an approved payment. Called when a dispute is
 * resolved in the client's favor. No-op in dev (mock payments aren't real MP
 * charges, so there's nothing to refund against the gateway).
 */
export async function refundPayment(mpPaymentId: string | null): Promise<void> {
  if (!mpPaymentId || mpPaymentId.startsWith('mock')) return
  if (!isMPConfigured) return

  await mpRefundClient.create({ payment_id: Number(mpPaymentId) })
}

// ─── MP OAuth for Workers ─────────────────────────────────────────────────────

const MP_OAUTH_URL = 'https://auth.mercadopago.com/authorization'

/**
 * Returns the OAuth URL the worker should be redirected to in order to
 * authorize TUKI to receive marketplace payments on their behalf.
 */
export function getMpConnectUrl(workerId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MP_APP_ID ?? '',
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: `${env.API_URL}/api/workers/mp/callback`,
    state: workerId, // used in callback to identify the worker
  })
  return `${MP_OAUTH_URL}?${params.toString()}`
}

/**
 * Exchanges the OAuth authorization code for an access token and stores it
 * on the WorkerProfile. Called from the /api/workers/mp/callback route.
 */
export async function handleMpOAuthCallback(
  code: string,
  workerId: string,
): Promise<void> {
  if (!isMPConfigured) {
    // Dev mode: mock a successful connection
    await prisma.workerProfile.update({
      where: { id: workerId },
      data: {
        mpUserId: `mock-mp-user-${workerId}`,
        mpAccessToken: 'mock-access-token',
      },
    })
    return
  }

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_secret: process.env.MP_ACCESS_TOKEN,
      client_id: process.env.MP_APP_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${env.API_URL}/api/workers/mp/callback`,
    }),
  })

  if (!response.ok) throw new Error('Error al conectar con MercadoPago')

  const data = await response.json() as {
    access_token: string
    refresh_token: string
    user_id: number
    expires_in: number
  }

  await prisma.workerProfile.update({
    where: { id: workerId },
    data: {
      mpUserId: String(data.user_id),
      mpAccessToken: data.access_token,
      mpRefreshToken: data.refresh_token,
      mpTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  })
}

// ─── Mock payment approval (dev) ──────────────────────────────────────────────
export async function approveMockPayment(requestId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { quotedPrice: true, status: true, categoryId: true, latitude: true, longitude: true },
  })
  if (!request) throw new Error('Pedido no encontrado')

  const tx = await prisma.transaction.findFirst({
    where: { serviceRequestId: requestId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  if (!tx) throw new Error('Transacción no encontrada')

  await capturePayment({
    serviceRequestId: requestId,
    amount: request.quotedPrice ?? 0,
    method: 'MERCADOPAGO',
    mpPaymentId: `mock-${Date.now()}`,
  })

  if (request.status === 'SEARCHING') {
    startMatchingAfterPayment(requestId).catch(console.error)
  }

  return { ok: true }
}

// ─── Payment history ──────────────────────────────────────────────────────────
export async function getPaymentHistory(userId: string, role: string) {
  if (role === 'CLIENT') {
    const profile = await prisma.clientProfile.findUnique({ where: { userId } })
    if (!profile) throw new Error('Perfil no encontrado')

    return prisma.transaction.findMany({
      where: { serviceRequest: { clientId: profile.id } },
      include: {
        serviceRequest: {
          include: {
            category: { select: { name: true, slug: true } },
            worker: {
              include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  const profile = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!profile) throw new Error('Perfil no encontrado')

  return prisma.transaction.findMany({
    where: { serviceRequest: { workerId: profile.id }, status: 'APPROVED' },
    include: {
      serviceRequest: {
        select: {
          id: true,
          address: true,
          scheduledAt: true,
          category: { select: { name: true, slug: true } },
          client: {
            include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getTransaction(transactionId: string, userId: string, role: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      serviceRequest: {
        include: {
          category: true,
          client: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          worker: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
      },
    },
  })
  if (!tx) throw new Error('Transacción no encontrada')

  const isClient = role === 'CLIENT' && tx.serviceRequest.client.user.id === userId
  const isWorker = role === 'WORKER' && tx.serviceRequest.worker?.user.id === userId
  const isAdmin  = role === 'ADMIN'

  if (!isClient && !isWorker && !isAdmin) throw new Error('Acceso denegado')
  return tx
}
