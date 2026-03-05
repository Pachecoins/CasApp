import { prisma } from '../config/prisma.js'
import { mpPreferenceClient, mpPaymentClient, isMPConfigured } from '../config/mercadopago.js'
import { env } from '../config/env.js'
import { notifyNearbyWorkersExport } from './requests.service.js'

const PLATFORM_COMMISSION = env.PLATFORM_COMMISSION // 0.20

// ─── Create Preference ────────────────────────────────────────────────────────
export async function createPaymentPreference(requestId: string, userId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      client: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
    },
  })

  if (!request) throw new Error('Pedido no encontrado')
  if (request.status !== 'PENDING_PAYMENT')
    throw new Error('Este pedido ya fue procesado o no está pendiente de pago')

  const amount = request.finalPrice ?? 0
  if (amount <= 0) throw new Error('Precio inválido')

  const workerEarnings = amount * (1 - PLATFORM_COMMISSION)

  // Create pending transaction
  const transaction = await prisma.transaction.create({
    data: {
      serviceRequestId: requestId,
      amount,
      currency: 'ARS',
      method: 'MERCADOPAGO',
      status: 'PENDING',
      workerEarnings,
    },
  })

  // If MP is not configured (dev mode), return mock preference
  if (!isMPConfigured) {
    return {
      transactionId: transaction.id,
      initPoint: `${env.CLIENT_APP_URL}/payment/result?requestId=${requestId}&status=approved&mock=1`,
      preferenceId: 'mock-preference-id',
      isMock: true,
    }
  }

  const clientUrl = env.CLIENT_APP_URL
  const preference = await mpPreferenceClient.create({
    body: {
      items: [
        {
          id: request.categoryId,
          title: `CasApp — ${request.category.name}`,
          description: request.description || request.category.name,
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
      back_urls: {
        success: `${clientUrl}/payment/result?requestId=${requestId}&status=approved`,
        failure: `${clientUrl}/payment/result?requestId=${requestId}&status=rejected`,
        pending: `${clientUrl}/payment/result?requestId=${requestId}&status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${env.API_URL ?? 'http://localhost:3000'}/api/payments/webhook`,
      external_reference: `${requestId}::${transaction.id}`,
      expires: false,
      metadata: {
        requestId,
        transactionId: transaction.id,
      },
    },
  })

  // Persist preferenceId
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

// ─── Process Webhook ─────────────────────────────────────────────────────────
export async function processWebhook(topic: string, resourceId: string, rawBody: unknown) {
  // MP sends: { type: "payment", data: { id: "payment_id" } }
  if (topic !== 'payment') return { ignored: true }

  let paymentData: { id: number | string; status: string; external_reference?: string; transaction_amount?: number }

  if (isMPConfigured) {
    const payment = await mpPaymentClient.get({ id: Number(resourceId) })
    paymentData = {
      id: payment.id!,
      status: payment.status!,
      external_reference: payment.external_reference ?? undefined,
      transaction_amount: payment.transaction_amount ?? undefined,
    }
  } else {
    // Mock: parse from external_reference stored in our DB
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

  const mpStatus = paymentData.status // approved | rejected | pending | in_process
  const txStatus = mpStatus === 'approved' ? 'APPROVED'
    : mpStatus === 'rejected' ? 'REJECTED'
    : 'PENDING'

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: txStatus as 'APPROVED' | 'REJECTED' | 'PENDING',
      mpPaymentId: String(paymentData.id),
      rawWebhookData: rawBody as object,
    },
  })

  if (txStatus === 'APPROVED') {
    // Update request payment status and move to PENDING to start matching
    const request = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: 'PENDING',
        paymentStatus: 'PAID',
      },
      include: { category: true },
    })

    // For ON_DEMAND: start worker matching now that payment is confirmed
    if (request.type === 'ON_DEMAND') {
      notifyNearbyWorkersExport(
        request.id,
        request.latitude,
        request.longitude,
        request.categoryId,
      ).catch(console.error)
    }
  } else if (txStatus === 'REJECTED') {
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    })
  }

  return { processed: true, status: txStatus }
}

// ─── Mock approval (dev only) ─────────────────────────────────────────────────
export async function approveMockPayment(requestId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { category: true },
  })
  if (!request) throw new Error('Pedido no encontrado')

  const tx = await prisma.transaction.findFirst({
    where: { serviceRequestId: requestId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  if (!tx) throw new Error('Transacción no encontrada')

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: 'APPROVED', mpPaymentId: `mock-${Date.now()}` },
  })

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status: 'PENDING', paymentStatus: 'PAID' },
  })

  if (request.type === 'ON_DEMAND') {
    notifyNearbyWorkersExport(requestId, request.latitude, request.longitude, request.categoryId).catch(
      console.error,
    )
  }

  return updated
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

  // WORKER — earnings
  const profile = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!profile) throw new Error('Perfil no encontrado')

  return prisma.transaction.findMany({
    where: {
      serviceRequest: { workerId: profile.id },
      status: 'APPROVED',
    },
    include: {
      serviceRequest: {
        include: {
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

// ─── Single transaction ───────────────────────────────────────────────────────
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

  // Access control
  const isClient = role === 'CLIENT' && tx.serviceRequest.client.user.id === userId
  const isWorker = role === 'WORKER' && tx.serviceRequest.worker?.user.id === userId
  const isAdmin = role === 'ADMIN'

  if (!isClient && !isWorker && !isAdmin) throw new Error('Acceso denegado')

  return tx
}
