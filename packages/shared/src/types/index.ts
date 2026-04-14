// ─── ENUMS ───────────────────────────────────────────────────────────────────

export type Role = 'CLIENT' | 'WORKER' | 'ADMIN'

/**
 * TUKI order state machine:
 * searching → assigned → en_route → in_progress → finished_pending_approval
 *           → completed  |  disputed
 */
export type OrderStatus =
  | 'SEARCHING'                 // broadcasting to nearby workers
  | 'ASSIGNED'                  // a worker claimed the job (atomic)
  | 'EN_ROUTE'                  // worker pressed "En camino"
  | 'IN_PROGRESS'               // worker pressed "Llegué al domicilio"
  | 'FINISHED_PENDING_APPROVAL' // worker uploaded completion photo
  | 'COMPLETED'                 // client pressed "Todo excelente / Liberar pago"
  | 'DISPUTED'                  // dispute opened — funds frozen
  | 'CANCELLED'                 // cancelled before assignment

/** Kept for backwards-compat with existing route code; alias of OrderStatus */
export type ServiceStatus = OrderStatus

/** Visual lot-size selector shown to the client during quoting */
export type LotSize = 'SMALL' | 'MEDIUM' | 'LARGE'

/** Worker equipment tier — drives per-m² pricing and speed estimates */
export type EquipmentTier = 'STANDARD' | 'PREMIUM'

export type SubscriptionFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'RELEASED' | 'REFUNDED' | 'FAILED'

export type EscrowStatus = 'HELD' | 'RELEASED' | 'FROZEN' | 'REFUNDED'

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'

export type TransactionMethod = 'MERCADOPAGO' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH'

/** Qualitative review tags selectable by the client */
export type ReviewTag = 'PUNCTUAL' | 'HONEST' | 'TIDY' | 'PROFESSIONAL' | 'CAREFUL'

// ─── ADDON DEFINITIONS ───────────────────────────────────────────────────────

export interface AddonDefinition {
  key: string
  label: string
  description?: string
  surchargeType: 'flat' | 'percent'
  value: number // flat: ARS amount; percent: percentage integer (e.g. 20 = 20%)
}

// ─── BASE ENTITIES ────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  phone?: string
  firstName: string
  lastName: string
  avatarUrl?: string
  role: Role
  createdAt: string
  updatedAt: string
}

export interface ClientProfile {
  id: string
  userId: string
  preferredPaymentMethod?: string
  addresses: ClientAddress[]
}

export interface ClientAddress {
  id: string
  clientId: string
  label: string            // "Casa", "Trabajo", "Country", etc.
  address: string
  latitude: number
  longitude: number
  isGatedCommunity: boolean // only insured workers shown for gated communities
  isDefault: boolean
}

export interface WorkerProfile {
  id: string
  userId: string
  bio?: string
  rating: number
  totalReviews: number
  isAvailable: boolean
  currentLatitude?: number
  currentLongitude?: number
  radiusKm: number

  // Onboarding / identity
  isVerified: boolean
  identityVerified: boolean
  dniFrontUrl?: string
  dniBackUrl?: string
  selfieBiometricUrl?: string

  // Insurance (required for gated-community jobs)
  insurancePolicyUrl?: string
  insuranceVerified: boolean
  insuranceExpiresAt?: string

  // Bank account (CBU/CVU must match DNI)
  bankCvu?: string
  bankAccountVerified: boolean

  // Wallet
  walletBalanceCents: number
}

export interface WorkerEquipment {
  id: string
  workerId: string
  name: string
  description?: string
  photoUrl: string
  isVerified: boolean
  verifiedAt?: string
  createdAt: string
}

export interface ServiceCategory {
  id: string
  name: string
  slug: string
  iconUrl?: string
  description?: string
  basePriceStandard: number
  basePricePremium: number
  pricePerM2Standard: number
  pricePerM2Premium: number
  addonDefinitions: AddonDefinition[]
  isActive: boolean
}

export interface WorkerService {
  id: string
  workerId: string
  categoryId: string
  equipmentTier: EquipmentTier
  yearsExperience: number
  portfolio: string[] // photo URLs
  isActive: boolean
}

export interface ServiceRequest {
  id: string
  clientId: string
  categoryId: string
  workerId?: string
  status: OrderStatus

  // Location
  address: string
  latitude: number
  longitude: number

  // Quoting
  lotSize?: LotSize
  lotAreaM2?: number
  addons: string[] // array of addon keys
  quotedPrice?: number
  finalPrice?: number
  platformFeePercent: number

  // Payment
  paymentStatus: PaymentStatus
  paymentIntentId?: string

  // Evidence
  completionPhotoUrl?: string

  scheduledAt?: string
  description?: string
  estimatedDuration?: number

  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  clientId: string
  workerId?: string // the Pro the client subscribed to ("TUKI Favorito")
  categoryId: string
  frequency: SubscriptionFrequency
  dayOfWeek: number
  timeSlot: string
  isActive: boolean
  nextServiceDate?: string
  pricePerVisit: number
  startedAt: string
  cancelledAt?: string
  cancellationNote?: string
}

export interface Review {
  id: string
  serviceRequestId: string
  reviewerId: string
  revieweeId: string
  rating: number        // 1–5 stars
  comment?: string
  tags: ReviewTag[]     // qualitative tags: "Puntual", "Prolijo", etc.
  createdAt: string
}

export interface Transaction {
  id: string
  serviceRequestId: string
  amount: number
  currency: string
  method: TransactionMethod
  status: TransactionStatus
  mpPaymentId?: string
  mpPreferenceId?: string

  // Escrow
  escrowStatus: EscrowStatus
  heldAt?: string
  releasedAt?: string
  frozenAt?: string
  refundedAt?: string

  workerEarnings?: number
  platformFee?: number

  createdAt: string
  updatedAt: string
}

export interface Dispute {
  id: string
  serviceRequestId: string
  raisedByUserId: string
  reason: string
  evidenceUrls: string[]
  resolvedAt?: string
  resolvedByUserId?: string
  resolution?: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: 'ORDER_UPDATE' | 'PAYMENT' | 'REVIEW' | 'CHAT' | 'SYSTEM'
  isRead: boolean
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface ChatMessage {
  id: string
  requestId: string
  senderId: string
  senderName: string
  message: string
  timestamp: string
}

// ─── API TYPES ────────────────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ─── AUTH TYPES ───────────────────────────────────────────────────────────────

export interface RegisterClientPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  // First address
  address?: string
  latitude?: number
  longitude?: number
  isGatedCommunity?: boolean
}

export interface RegisterWorkerPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  bio?: string
  radiusKm?: number
  categoryIds?: string[]
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

// ─── EXTENDED TYPES (with relations) ─────────────────────────────────────────

export interface UserWithProfile extends User {
  clientProfile?: ClientProfile
  workerProfile?: WorkerProfile
}

export interface WorkerPublicProfile extends WorkerProfile {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  workerServices: Array<WorkerService & { category: ServiceCategory }>
  equipment: WorkerEquipment[]
  distanceKm?: number
  estimatedArrivalMin?: number
}

export interface ServiceRequestWithDetails extends ServiceRequest {
  client?: Pick<User, 'firstName' | 'lastName' | 'avatarUrl' | 'phone'>
  worker?: WorkerPublicProfile
  category?: ServiceCategory
  review?: Review
  transaction?: Transaction
}

// ─── QUOTING ──────────────────────────────────────────────────────────────────

export interface QuoteParams {
  categorySlug: string
  lotSize: LotSize
  lotAreaM2?: number             // optional exact area; used when provided
  selectedAddons: string[]       // addon keys
  equipmentTier: EquipmentTier
  isGatedCommunity?: boolean
}

export interface QuoteBreakdown {
  basePrice: number              // base price for the lot size & tier
  areasSurcharge: number         // extra for m² above SMALL threshold
  addonsTotal: number            // sum of selected addons
  subtotal: number
  platformFee: number            // TUKI commission (15% of subtotal)
  total: number                  // what the client pays
  workerEarnings: number         // what the worker receives
  estimatedDurationMin: number   // rough job duration estimate
}

// ─── PRICE CALCULATION (legacy, kept for compatibility) ───────────────────────

export interface PriceBreakdown {
  basePrice: number
  modalityMultiplier: number
  distanceSurcharge: number
  nightSurcharge: number
  platformCommission: number
  total: number
}

export interface CalculatePriceParams {
  basePrice: number
  type: 'ON_DEMAND' | 'SCHEDULED' | 'SUBSCRIPTION'
  frequency?: SubscriptionFrequency
  distanceKm?: number
  isNighttime?: boolean
}

// ─── SOCKET EVENTS ───────────────────────────────────────────────────────────

export interface WorkerLocationUpdate {
  workerId: string
  latitude: number
  longitude: number
  requestId?: string
}

export interface OrderStatusChange {
  requestId: string
  status: OrderStatus
  updatedAt: string
  completionPhotoUrl?: string // included when moving to FINISHED_PENDING_APPROVAL
}

/** @deprecated Use OrderStatusChange */
export interface RequestStatusChange extends OrderStatusChange {}

export interface IncomingRequest {
  request: ServiceRequestWithDetails
  expiresAt: string // ISO datetime — worker has ~30s to accept before it broadcasts to next
}
