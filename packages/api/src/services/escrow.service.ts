import { prisma } from '../config/prisma.js'

const PLATFORM_COMMISSION = 0.15 // 15% — must match the value in schema default

/**
 * TUKI Escrow Service
 *
 * Lifecycle:
 *   capturePayment()  — called when client confirms checkout (funds HELD)
 *   releaseToWorker() — called when client presses "Todo excelente / Liberar pago"
 *   freezeForDispute()— called when client opens a dispute (funds FROZEN)
 *   refundToClient()  — called by a moderator when dispute is resolved in client's favor
 *   releaseAfterDispute() — called by a moderator in worker's favor
 *
 * All state transitions are wrapped in Prisma transactions to prevent
 * partial updates. The ServiceRequest.paymentStatus and
 * Transaction.escrowStatus are always kept in sync.
 */

// ─── CAPTURE (funds held) ────────────────────────────────────────────────────

/**
 * Record a successful payment capture (MercadoPago webhook confirms payment).
 * Creates the Transaction record and moves paymentStatus to CAPTURED.
 */
export async function capturePayment(params: {
  serviceRequestId: string
  amount: number
  method: 'MERCADOPAGO' | 'CREDIT_CARD' | 'DEBIT_CARD'
  mpPaymentId?: string
  mpPreferenceId?: string
}): Promise<void> {
  const { serviceRequestId, amount, method, mpPaymentId, mpPreferenceId } = params

  const platformFee = Math.round(amount * PLATFORM_COMMISSION)
  const workerEarnings = amount - platformFee

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        serviceRequestId,
        amount,
        method,
        status: 'APPROVED',
        mpPaymentId,
        mpPreferenceId,
        escrowStatus: 'HELD',
        heldAt: new Date(),
        platformFee,
        workerEarnings,
      },
    }),
    prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        paymentStatus: 'CAPTURED',
        paymentIntentId: mpPaymentId,
      },
    }),
  ])
}

// ─── RELEASE (client approves — funds go to worker) ──────────────────────────

/**
 * Release escrowed funds to the worker after client approval.
 * Credits the worker's wallet and marks the order as COMPLETED.
 */
export async function releaseToWorker(serviceRequestId: string): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { serviceRequestId, escrowStatus: 'HELD' },
    select: { id: true, workerEarnings: true },
  })

  if (!tx) {
    throw new Error(`No held transaction found for request ${serviceRequestId}`)
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: { workerId: true },
  })

  if (!request?.workerId) {
    throw new Error(`Service request ${serviceRequestId} has no assigned worker`)
  }

  // Worker earnings in ARS cents (integer) to avoid float rounding
  const earningsCents = Math.round((tx.workerEarnings ?? 0) * 100)

  await prisma.$transaction([
    // Mark transaction as released
    prisma.transaction.update({
      where: { id: tx.id },
      data: {
        escrowStatus: 'RELEASED',
        releasedAt: new Date(),
        status: 'APPROVED',
      },
    }),
    // Credit worker wallet
    prisma.workerProfile.update({
      where: { id: request.workerId },
      data: {
        walletBalanceCents: { increment: earningsCents },
      },
    }),
    // Complete the order
    prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        status: 'COMPLETED',
        paymentStatus: 'RELEASED',
      },
    }),
  ])
}

// ─── FREEZE (dispute opened) ─────────────────────────────────────────────────

/**
 * Freeze funds when a client opens a dispute.
 * Moves the order to DISPUTED and creates a Dispute record.
 */
export async function freezeForDispute(params: {
  serviceRequestId: string
  raisedByUserId: string
  reason: string
  evidenceUrls?: string[]
}): Promise<void> {
  const { serviceRequestId, raisedByUserId, reason, evidenceUrls = [] } = params

  const tx = await prisma.transaction.findFirst({
    where: {
      serviceRequestId,
      escrowStatus: { in: ['HELD', 'RELEASED'] },
    },
    select: { id: true },
  })

  if (!tx) {
    throw new Error(`No active transaction found for request ${serviceRequestId}`)
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: tx.id },
      data: {
        escrowStatus: 'FROZEN',
        frozenAt: new Date(),
      },
    }),
    prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: 'DISPUTED' },
    }),
    prisma.dispute.upsert({
      where: { serviceRequestId },
      create: {
        serviceRequestId,
        raisedByUserId,
        reason,
        evidenceUrls: JSON.stringify(evidenceUrls),
      },
      update: {
        reason,
        evidenceUrls: JSON.stringify(evidenceUrls),
      },
    }),
  ])
}

// ─── MODERATOR RESOLUTION ────────────────────────────────────────────────────

/**
 * Moderator resolves a dispute in favor of the worker.
 * Releases frozen funds to the worker.
 */
export async function resolveDisputeForWorker(params: {
  serviceRequestId: string
  resolvedByUserId: string
  resolution: string
}): Promise<void> {
  const { serviceRequestId, resolvedByUserId, resolution } = params

  const tx = await prisma.transaction.findFirst({
    where: { serviceRequestId, escrowStatus: 'FROZEN' },
    select: { id: true, workerEarnings: true },
  })

  if (!tx) throw new Error(`No frozen transaction for request ${serviceRequestId}`)

  const request = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: { workerId: true },
  })

  if (!request?.workerId) throw new Error('No worker on this request')

  const earningsCents = Math.round((tx.workerEarnings ?? 0) * 100)

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: tx.id },
      data: { escrowStatus: 'RELEASED', releasedAt: new Date() },
    }),
    prisma.workerProfile.update({
      where: { id: request.workerId },
      data: { walletBalanceCents: { increment: earningsCents } },
    }),
    prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: 'COMPLETED', paymentStatus: 'RELEASED' },
    }),
    prisma.dispute.update({
      where: { serviceRequestId },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId,
        resolution,
      },
    }),
  ])
}

/**
 * Moderator resolves a dispute in favor of the client.
 * Refunds frozen funds to the client (actual refund initiated via payment gateway).
 */
export async function resolveDisputeForClient(params: {
  serviceRequestId: string
  resolvedByUserId: string
  resolution: string
}): Promise<void> {
  const { serviceRequestId, resolvedByUserId, resolution } = params

  const tx = await prisma.transaction.findFirst({
    where: { serviceRequestId, escrowStatus: 'FROZEN' },
    select: { id: true, mpPaymentId: true },
  })

  if (!tx) throw new Error(`No frozen transaction for request ${serviceRequestId}`)

  // Issue the refund via MP before flipping our own records, so a gateway
  // failure doesn't leave us thinking money moved when it didn't.
  const { refundPayment } = await import('./payments.service.js')
  await refundPayment(tx.mpPaymentId)

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: tx.id },
      data: {
        escrowStatus: 'REFUNDED',
        refundedAt: new Date(),
        status: 'REFUNDED',
      },
    }),
    prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' },
    }),
    prisma.dispute.update({
      where: { serviceRequestId },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId,
        resolution,
      },
    }),
  ])
}

// ─── AUTO-RELEASE (24h cron) ─────────────────────────────────────────────────

const AUTO_RELEASE_HOURS = 24

/**
 * Finds all orders stuck in FINISHED_PENDING_APPROVAL for more than 24 hours
 * and automatically releases the escrow to the worker.
 * Designed to be called from a recurring cron job (every hour).
 */
export async function autoReleaseOverdueOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - AUTO_RELEASE_HOURS * 60 * 60 * 1000)

  const overdueOrders = await prisma.serviceRequest.findMany({
    where: {
      status: 'FINISHED_PENDING_APPROVAL',
      finishedAt: { lte: cutoff },
    },
    select: { id: true },
  })

  if (overdueOrders.length === 0) return

  console.log(`[Escrow Auto-Release] Processing ${overdueOrders.length} overdue order(s)`)

  for (const order of overdueOrders) {
    try {
      await releaseToWorker(order.id)
      console.log(`[Escrow Auto-Release] Released: ${order.id}`)
    } catch (err) {
      console.error(`[Escrow Auto-Release] Failed for ${order.id}:`, err)
    }
  }
}

// ─── WALLET WITHDRAWAL ───────────────────────────────────────────────────────

/**
 * Deduct from the worker's wallet balance and queue a WithdrawalRequest for
 * an admin to pay out manually (bank transfer outside the app, then marked
 * PAID — see WithdrawalRequest doc comment in schema.prisma).
 */
export async function deductWalletForWithdrawal(
  workerId: string,
  amountCents: number,
) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: { walletBalanceCents: true, bankAccountVerified: true, bankCvu: true },
  })

  if (!worker) throw new Error('Worker not found')
  if (!worker.bankAccountVerified || !worker.bankCvu) {
    throw new Error('Bank account must be verified before withdrawal')
  }
  if (worker.walletBalanceCents < amountCents) {
    throw new Error('Insufficient wallet balance')
  }

  const [, withdrawal] = await prisma.$transaction([
    prisma.workerProfile.update({
      where: { id: workerId },
      data: { walletBalanceCents: { decrement: amountCents } },
    }),
    prisma.withdrawalRequest.create({
      data: { workerId, amountCents, bankCvu: worker.bankCvu },
    }),
  ])

  return withdrawal
}

/**
 * Admin marks a withdrawal as paid (after transferring the funds manually) or
 * rejected (credits the wallet back).
 */
export async function resolveWithdrawal(
  withdrawalId: string,
  status: 'PAID' | 'REJECTED',
  adminNote?: string,
): Promise<void> {
  const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } })
  if (!withdrawal) throw new Error('Retiro no encontrado')
  if (withdrawal.status !== 'PENDING') throw new Error('Este retiro ya fue procesado')

  await prisma.$transaction([
    prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status, adminNote, processedAt: new Date() },
    }),
    ...(status === 'REJECTED'
      ? [
          prisma.workerProfile.update({
            where: { id: withdrawal.workerId },
            data: { walletBalanceCents: { increment: withdrawal.amountCents } },
          }),
        ]
      : []),
  ])
}
