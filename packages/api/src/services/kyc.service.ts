/**
 * TUKI KYC Service
 *
 * Abstracts the external identity-verification provider (1c: external KYC, e.g. Renaper / Jumio).
 * Responsibilities:
 *   1. Upload document images to Cloudinary
 *   2. Send the Cloudinary URLs to the configured KYC provider
 *   3. Receive the KYC result via webhook (POST /api/workers/kyc/webhook)
 *   4. Update WorkerProfile.kycStatus accordingly
 *   5. Insurance docs go to Cloudinary → admin reviews in panel (not the KYC provider)
 *
 * To swap providers: implement the `KycProviderAdapter` interface and plug it in below.
 */

import { prisma } from '../config/prisma.js'
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js'

// ─── CLOUDINARY UPLOAD ────────────────────────────────────────────────────────

type DocType =
  | 'dni_front'
  | 'dni_back'
  | 'selfie'
  | 'insurance_policy'
  | 'equipment'
  | 'completion_photo'

/**
 * Upload a base64-encoded image (or a file path) to Cloudinary.
 * Returns the secure URL.
 */
export async function uploadDocument(
  base64OrPath: string,
  workerId: string,
  docType: DocType,
): Promise<string> {
  if (!isCloudinaryConfigured) {
    // Dev mode: return a placeholder URL
    return `https://placehold.co/800x600?text=${docType}_${workerId}`
  }

  const folder = `tuki/workers/${workerId}/${docType}`
  const result = await cloudinary.uploader.upload(base64OrPath, {
    folder,
    resource_type: 'image',
    // Restrict access — documents are private assets
    type: 'authenticated',
    overwrite: true,
    public_id: `${docType}_${Date.now()}`,
  })

  return result.secure_url
}

// ─── KYC PROVIDER ADAPTER ────────────────────────────────────────────────────

interface KycSubmission {
  workerId: string
  dniFrontUrl: string
  dniBackUrl: string
  selfieUrl: string
}

interface KycProviderAdapter {
  /** Submit documents to the provider. Returns a provider reference ID. */
  submit(data: KycSubmission): Promise<string>
  /** Parse a raw webhook payload into a standard result. */
  parseWebhook(payload: unknown): { providerRef: string; approved: boolean; reason?: string }
}

/**
 * Mock adapter — used in dev / when no KYC provider is configured.
 * Auto-approves after recording the submission.
 */
const mockAdapter: KycProviderAdapter = {
  async submit(data) {
    console.log(`[KYC Mock] Submission received for worker ${data.workerId}`)
    // In real implementation this would call Renaper / Jumio / etc.
    return `mock-kyc-ref-${data.workerId}-${Date.now()}`
  },
  parseWebhook(payload) {
    const p = payload as { reference: string; status: string }
    return {
      providerRef: p.reference ?? '',
      approved: p.status === 'approved',
      reason: p.status !== 'approved' ? 'Rejected by mock provider' : undefined,
    }
  },
}

// Real provider adapter skeleton — replace mockAdapter with this when credentials are available
// const renaperAdapter: KycProviderAdapter = {
//   async submit(data) { /* call Renaper SDK */ },
//   parseWebhook(payload) { /* parse Renaper webhook shape */ },
// }

const kycProvider: KycProviderAdapter = mockAdapter

// ─── BUSINESS LOGIC ───────────────────────────────────────────────────────────

/**
 * Step 1-3 of onboarding: upload DNI + selfie, then submit to KYC provider.
 * Call this after the worker has uploaded all 3 documents.
 */
export async function submitIdentityVerification(
  workerId: string,
  docs: { dniFrontBase64: string; dniBackBase64: string; selfieBase64: string },
): Promise<void> {
  const [dniFrontUrl, dniBackUrl, selfieUrl] = await Promise.all([
    uploadDocument(docs.dniFrontBase64, workerId, 'dni_front'),
    uploadDocument(docs.dniBackBase64, workerId, 'dni_back'),
    uploadDocument(docs.selfieBase64, workerId, 'selfie'),
  ])

  // Persist URLs immediately so they're not lost if the provider call fails
  await prisma.workerProfile.update({
    where: { id: workerId },
    data: { dniFrontUrl, dniBackUrl, selfieBiometricUrl: selfieUrl, kycStatus: 'SUBMITTED' },
  })

  // Submit to external KYC provider
  const providerRef = await kycProvider.submit({ workerId, dniFrontUrl, dniBackUrl, selfieUrl })

  await prisma.workerProfile.update({
    where: { id: workerId },
    data: { kycProviderRef: providerRef },
  })
}

/**
 * Called from POST /api/workers/kyc/webhook.
 * Updates kycStatus and, if approved, marks identityVerified = true.
 */
export async function handleKycWebhook(payload: unknown): Promise<void> {
  const { providerRef, approved, reason } = kycProvider.parseWebhook(payload)

  const worker = await prisma.workerProfile.findFirst({
    where: { kycProviderRef: providerRef },
  })
  if (!worker) {
    console.warn(`[KYC] Webhook received for unknown providerRef: ${providerRef}`)
    return
  }

  await prisma.workerProfile.update({
    where: { id: worker.id },
    data: {
      kycStatus: approved ? 'APPROVED' : 'REJECTED',
      identityVerified: approved,
      isVerified: approved && worker.insuranceVerified, // fully verified when both pass
    },
  })

  if (!approved) {
    console.warn(`[KYC] Worker ${worker.id} rejected. Reason: ${reason}`)
  }
}

/**
 * Step 4 of onboarding: upload insurance / ART policy document.
 * Admin reviews manually in the panel and calls approveInsurance().
 */
export async function uploadInsurancePolicy(
  workerId: string,
  policyBase64: string,
): Promise<string> {
  const url = await uploadDocument(policyBase64, workerId, 'insurance_policy')

  await prisma.workerProfile.update({
    where: { id: workerId },
    data: { insurancePolicyUrl: url },
  })

  return url
}

/**
 * Called by admin when they review and approve the insurance document.
 * Updates insuranceVerified and sets expiry date.
 */
export async function approveInsurance(
  workerId: string,
  expiresAt: Date,
): Promise<void> {
  const worker = await prisma.workerProfile.findUnique({ where: { id: workerId } })
  if (!worker) throw new Error('Worker not found')

  await prisma.workerProfile.update({
    where: { id: workerId },
    data: {
      insuranceVerified: true,
      insuranceExpiresAt: expiresAt,
      // fully verified when both identity and insurance are approved
      isVerified: worker.identityVerified,
    },
  })
}

/**
 * Called by admin when they reject the insurance document.
 * Clears the URL so the worker can re-upload.
 */
export async function rejectInsurance(workerId: string): Promise<void> {
  await prisma.workerProfile.update({
    where: { id: workerId },
    data: { insurancePolicyUrl: null, insuranceVerified: false, isVerified: false },
  })
}

/**
 * Called by admin to manually approve identity KYC (override of provider result).
 */
export async function approveKycManually(workerId: string): Promise<void> {
  const worker = await prisma.workerProfile.findUnique({ where: { id: workerId } })
  if (!worker) throw new Error('Worker not found')
  await prisma.workerProfile.update({
    where: { id: workerId },
    data: {
      kycStatus: 'APPROVED',
      identityVerified: true,
      isVerified: worker.insuranceVerified,
    },
  })
}

/**
 * Upload an equipment photo and create a WorkerEquipment record.
 */
export async function uploadEquipmentPhoto(
  workerId: string,
  name: string,
  photoBase64: string,
  description?: string,
): Promise<{ id: string; photoUrl: string }> {
  const photoUrl = await uploadDocument(photoBase64, workerId, 'equipment')

  const equipment = await prisma.workerEquipment.create({
    data: { workerId, name, photoUrl, description },
  })

  return { id: equipment.id, photoUrl }
}

/**
 * Returns the current onboarding completion status for a worker.
 */
export async function getOnboardingStatus(workerId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: {
      dniFrontUrl: true,
      dniBackUrl: true,
      selfieBiometricUrl: true,
      kycStatus: true,
      identityVerified: true,
      insurancePolicyUrl: true,
      insuranceVerified: true,
      bankCvu: true,
      bankAccountVerified: true,
      mpUserId: true,
      equipment: { select: { id: true } },
    },
  })
  if (!worker) throw new Error('Worker not found')

  return {
    step1_identity: {
      done: worker.kycStatus === 'APPROVED',
      status: worker.kycStatus,
      hasDniFront: !!worker.dniFrontUrl,
      hasDniBack: !!worker.dniBackUrl,
      hasSelfie: !!worker.selfieBiometricUrl,
    },
    step2_equipment: {
      done: worker.equipment.length > 0,
      count: worker.equipment.length,
    },
    step3_insurance: {
      done: worker.insuranceVerified,
      uploaded: !!worker.insurancePolicyUrl,
    },
    step4_mercadopago: {
      done: !!worker.mpUserId,
    },
    isFullyOnboarded:
      worker.kycStatus === 'APPROVED' &&
      worker.equipment.length > 0 &&
      !!worker.mpUserId,
  }
}
