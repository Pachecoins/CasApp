import type { CalculatePriceParams, PriceBreakdown, ServiceType, SubscriptionFrequency } from '../types/index.js'

const PLATFORM_COMMISSION = 0.20 // 20%
const DISTANCE_SURCHARGE_PER_KM = 50 // ARS per km beyond 5km
const FREE_DISTANCE_KM = 5
const NIGHT_SURCHARGE_MULTIPLIER = 0.20 // +20%

const MODALITY_MULTIPLIERS: Record<ServiceType, number | Record<SubscriptionFrequency, number>> = {
  ON_DEMAND: 1.35,
  SCHEDULED: 1.00,
  SUBSCRIPTION: {
    WEEKLY: 0.75,
    BIWEEKLY: 0.80,
    MONTHLY: 0.85,
  },
}

export function calculatePrice(params: CalculatePriceParams): PriceBreakdown {
  const { basePrice, type, frequency, distanceKm = 0, isNighttime = false } = params

  let modalityMultiplier: number

  if (type === 'SUBSCRIPTION') {
    if (!frequency) throw new Error('Frequency required for SUBSCRIPTION type')
    const subscriptionMultipliers = MODALITY_MULTIPLIERS.SUBSCRIPTION as Record<SubscriptionFrequency, number>
    modalityMultiplier = subscriptionMultipliers[frequency]
  } else {
    modalityMultiplier = MODALITY_MULTIPLIERS[type] as number
  }

  const distanceSurcharge =
    distanceKm > FREE_DISTANCE_KM
      ? (distanceKm - FREE_DISTANCE_KM) * DISTANCE_SURCHARGE_PER_KM
      : 0

  const nightSurcharge = isNighttime ? basePrice * modalityMultiplier * NIGHT_SURCHARGE_MULTIPLIER : 0

  const subtotal = basePrice * modalityMultiplier + distanceSurcharge + nightSurcharge
  const platformCommission = subtotal * PLATFORM_COMMISSION
  const total = subtotal + platformCommission

  return {
    basePrice,
    modalityMultiplier,
    distanceSurcharge,
    nightSurcharge,
    platformCommission,
    total: Math.round(total),
  }
}

export function isNighttimeRequest(date: Date = new Date()): boolean {
  const hour = date.getHours()
  return hour >= 20 || hour < 8
}

export function formatPrice(amount: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
