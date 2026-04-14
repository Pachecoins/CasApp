import { prisma } from '../config/prisma.js'
import { calculateDistance } from '@tuki/shared/utils/distance.js'

interface MatchOptions {
  categoryId: string
  latitude: number
  longitude: number
  /** True when the job is at a gated community (barrio cerrado). */
  isGatedCommunity: boolean
  /** Maximum search radius in km. Defaults to 15 km. */
  maxRadiusKm?: number
}

interface WorkerCandidate {
  workerId: string
  userId: string
  distanceKm: number
  estimatedArrivalMin: number
  equipmentTier: string
  rating: number
  insuranceVerified: boolean
}

/**
 * Find eligible TUKI Pro workers for a given service request.
 *
 * Matching rules (in order of application):
 *   1. Worker must be marked `isAvailable = true` and have a valid GPS position.
 *   2. Worker must offer the requested category (active WorkerService).
 *   3. Worker must be within their own `radiusKm` AND within `maxRadiusKm`.
 *   4. **Gated-community filter**: if `isGatedCommunity` is true, ONLY workers
 *      with `insuranceVerified = true` are eligible. Workers without a validated
 *      ART/personal-accident policy are silently excluded.
 *   5. Results are sorted by distance ascending, with a secondary sort by rating
 *      descending for workers at a similar distance (within 1 km of each other).
 */
export async function findEligibleWorkers(options: MatchOptions): Promise<WorkerCandidate[]> {
  const { categoryId, latitude, longitude, isGatedCommunity, maxRadiusKm = 15 } = options

  // Fetch all available workers offering this category with their current position
  const candidates = await prisma.workerProfile.findMany({
    where: {
      isAvailable: true,
      currentLatitude: { not: null },
      currentLongitude: { not: null },
      // Gated-community strict filter — applied in DB when possible
      ...(isGatedCommunity ? { insuranceVerified: true } : {}),
      workerServices: {
        some: {
          categoryId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      userId: true,
      currentLatitude: true,
      currentLongitude: true,
      radiusKm: true,
      rating: true,
      insuranceVerified: true,
      workerServices: {
        where: { categoryId, isActive: true },
        select: { equipmentTier: true },
      },
    },
  })

  const results: WorkerCandidate[] = []

  for (const worker of candidates) {
    // TypeScript narrowing — already filtered by NOT NULL in query but types are nullable
    if (worker.currentLatitude === null || worker.currentLongitude === null) continue

    const distanceKm = calculateDistance(
      latitude,
      longitude,
      worker.currentLatitude,
      worker.currentLongitude,
    )

    // Respect both the platform's max radius and the worker's own preferred radius
    if (distanceKm > maxRadiusKm || distanceKm > worker.radiusKm) continue

    const avgSpeedKmh = 30
    const estimatedArrivalMin = Math.ceil((distanceKm / avgSpeedKmh) * 60) + 5

    results.push({
      workerId: worker.id,
      userId: worker.userId,
      distanceKm: Math.round(distanceKm * 10) / 10,
      estimatedArrivalMin,
      equipmentTier: worker.workerServices[0]?.equipmentTier ?? 'STANDARD',
      rating: worker.rating,
      insuranceVerified: worker.insuranceVerified,
    })
  }

  // Sort: distance ASC, then rating DESC for workers within 1 km of each other
  results.sort((a, b) => {
    const distDiff = a.distanceKm - b.distanceKm
    if (Math.abs(distDiff) < 1) return b.rating - a.rating
    return distDiff
  })

  return results
}

/**
 * Broadcast an order to the nearest eligible workers sequentially.
 * Each worker gets `expiresInSeconds` to accept before the next one is notified.
 * This implements the atomic "first to press Accept wins" mechanic.
 *
 * Returns the list of worker user-IDs to notify (in priority order).
 */
export async function buildNotificationQueue(
  options: MatchOptions,
  limit = 10,
): Promise<string[]> {
  const eligible = await findEligibleWorkers(options)
  return eligible.slice(0, limit).map((w) => w.userId)
}

/**
 * Validate that a specific worker is still eligible to claim a given order.
 * Used server-side when a worker presses "Aceptar" to prevent race conditions.
 */
export async function validateWorkerEligibility(
  workerId: string,
  options: Omit<MatchOptions, 'maxRadiusKm'>,
): Promise<{ eligible: boolean; reason?: string }> {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: {
      isAvailable: true,
      currentLatitude: true,
      currentLongitude: true,
      radiusKm: true,
      insuranceVerified: true,
      workerServices: {
        where: { categoryId: options.categoryId, isActive: true },
      },
    },
  })

  if (!worker) return { eligible: false, reason: 'Worker not found' }
  if (!worker.isAvailable) return { eligible: false, reason: 'Worker is not available' }
  if (!worker.currentLatitude || !worker.currentLongitude)
    return { eligible: false, reason: 'Worker location unknown' }
  if (worker.workerServices.length === 0)
    return { eligible: false, reason: 'Worker does not offer this service' }

  if (options.isGatedCommunity && !worker.insuranceVerified) {
    return {
      eligible: false,
      reason: 'This job requires a validated ART/insurance policy. Upload yours in your profile.',
    }
  }

  const distanceKm = calculateDistance(
    options.latitude,
    options.longitude,
    worker.currentLatitude,
    worker.currentLongitude,
  )

  if (distanceKm > worker.radiusKm) {
    return { eligible: false, reason: 'Job is outside your configured work radius' }
  }

  return { eligible: true }
}
