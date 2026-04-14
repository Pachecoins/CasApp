import type {
  AddonDefinition,
  CalculatePriceParams,
  EquipmentTier,
  LotSize,
  PriceBreakdown,
  QuoteBreakdown,
  QuoteParams,
  ServiceCategory,
  SubscriptionFrequency,
} from '../types/index.js'

// ─── TUKI BUSINESS CONSTANTS ─────────────────────────────────────────────────

/** TUKI's platform commission (15% of subtotal). Applied to every completed job. */
const PLATFORM_COMMISSION = 0.15

/** Lot-size thresholds in m². "Small" is up to this boundary. */
const LOT_SIZE_THRESHOLDS: Record<LotSize, { min: number; max: number; defaultM2: number }> = {
  SMALL:  { min: 0,   max: 100, defaultM2: 60   },
  MEDIUM: { min: 100, max: 300, defaultM2: 200  },
  LARGE:  { min: 300, max: Infinity, defaultM2: 450 },
}

/** Rough job duration in minutes per lot size and equipment tier. */
const DURATION_ESTIMATES: Record<LotSize, Record<EquipmentTier, number>> = {
  SMALL:  { STANDARD: 90,  PREMIUM: 45  },
  MEDIUM: { STANDARD: 180, PREMIUM: 75  },
  LARGE:  { STANDARD: 300, PREMIUM: 120 },
}

// ─── TUKI QUOTER (new) ───────────────────────────────────────────────────────

/**
 * Calculate the full price breakdown for a TUKI job quote.
 * This drives the real-time totalizador in the client app.
 *
 * Logic:
 *   1. basePrice = category.basePrice{Standard|Premium}  (covers a SMALL lot)
 *   2. areasSurcharge = pricePerM2 * max(0, effectiveM2 - SMALL.max)
 *   3. addonsTotal = sum of selected addons (flat or percent of basePrice+areasSurcharge)
 *   4. subtotal = basePrice + areasSurcharge + addonsTotal
 *   5. platformFee = subtotal * 15%
 *   6. total = subtotal + platformFee
 *   7. workerEarnings = subtotal (worker gets full subtotal; TUKI fee is on top)
 */
export function calculateQuote(
  category: Pick<
    ServiceCategory,
    | 'basePriceStandard'
    | 'basePricePremium'
    | 'pricePerM2Standard'
    | 'pricePerM2Premium'
    | 'addonDefinitions'
  >,
  params: Omit<QuoteParams, 'categorySlug'>,
): QuoteBreakdown {
  const { lotSize, lotAreaM2, selectedAddons, equipmentTier } = params
  const isStandard = equipmentTier === 'STANDARD'

  const basePrice = isStandard ? category.basePriceStandard : category.basePricePremium
  const pricePerM2 = isStandard ? category.pricePerM2Standard : category.pricePerM2Premium

  // Effective area: use provided m² or fallback to lot-size default
  const effectiveM2 = lotAreaM2 ?? LOT_SIZE_THRESHOLDS[lotSize].defaultM2

  // Area surcharge is only applied for m² exceeding the SMALL lot threshold
  const excessM2 = Math.max(0, effectiveM2 - LOT_SIZE_THRESHOLDS.SMALL.max)
  const areasSurcharge = Math.round(excessM2 * pricePerM2)

  // Addon surcharges
  const addonMap = new Map<string, AddonDefinition>(
    category.addonDefinitions.map((a) => [a.key, a]),
  )
  let addonsTotal = 0
  for (const key of selectedAddons) {
    const addon = addonMap.get(key)
    if (!addon) continue
    if (addon.surchargeType === 'flat') {
      addonsTotal += addon.value
    } else {
      // percent surcharge applied to (basePrice + areasSurcharge)
      addonsTotal += Math.round(((basePrice + areasSurcharge) * addon.value) / 100)
    }
  }

  const subtotal = basePrice + areasSurcharge + addonsTotal
  const platformFee = Math.round(subtotal * PLATFORM_COMMISSION)
  const total = subtotal + platformFee

  return {
    basePrice,
    areasSurcharge,
    addonsTotal,
    subtotal,
    platformFee,
    total,
    workerEarnings: subtotal,
    estimatedDurationMin: DURATION_ESTIMATES[lotSize][equipmentTier],
  }
}

/**
 * Given a lot size label and optional exact m², return a human-readable range string.
 * Used in the quoter UI to confirm what the client is selecting.
 */
export function lotSizeLabel(lotSize: LotSize, lotAreaM2?: number): string {
  const labels: Record<LotSize, string> = {
    SMALL:  'Chico (hasta 100 m²)',
    MEDIUM: 'Mediano (100–300 m²)',
    LARGE:  'Grande (más de 300 m²)',
  }
  if (lotAreaM2) return `${lotAreaM2} m²`
  return labels[lotSize]
}

/**
 * Determine the LotSize bucket from an exact m² value.
 */
export function lotSizeFromM2(m2: number): LotSize {
  if (m2 <= LOT_SIZE_THRESHOLDS.SMALL.max) return 'SMALL'
  if (m2 <= LOT_SIZE_THRESHOLDS.MEDIUM.max) return 'MEDIUM'
  return 'LARGE'
}

// ─── LEGACY PRICE CALCULATOR (kept for backward compatibility) ────────────────

const DISTANCE_SURCHARGE_PER_KM = 50
const FREE_DISTANCE_KM = 5
const NIGHT_SURCHARGE_MULTIPLIER = 0.20

const MODALITY_MULTIPLIERS: Record<
  'ON_DEMAND' | 'SCHEDULED' | 'SUBSCRIPTION',
  number | Record<SubscriptionFrequency, number>
> = {
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
