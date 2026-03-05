// ─── ENUMS ───────────────────────────────────────────────────────────────────

export type Role = 'CLIENT' | 'WORKER' | 'ADMIN'

export type ServiceType = 'ON_DEMAND' | 'SCHEDULED' | 'SUBSCRIPTION'

export type ServiceStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'

export type SubscriptionFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'

export type TransactionMethod = 'MERCADOPAGO' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH'

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
  address?: string
  latitude?: number
  longitude?: number
  preferredPaymentMethod?: string
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
  isVerified: boolean
  identityVerified: boolean
}

export interface ServiceCategory {
  id: string
  name: string
  slug: string
  iconUrl?: string
  description?: string
  basePrice: number
  scheduledPrice: number
  isActive: boolean
}

export interface WorkerService {
  id: string
  workerId: string
  categoryId: string
  yearsExperience: number
  hourlyRate?: number
  portfolio: string[]
  isActive: boolean
}

export interface ServiceRequest {
  id: string
  clientId: string
  categoryId: string
  workerId?: string
  type: ServiceType
  status: ServiceStatus
  scheduledAt?: string
  address: string
  latitude: number
  longitude: number
  description?: string
  estimatedDuration?: number
  finalPrice?: number
  paymentStatus: PaymentStatus
  paymentIntentId?: string
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  clientId: string
  workerId?: string
  categoryId: string
  frequency: SubscriptionFrequency
  preferSameWorker: boolean
  dayOfWeek: number
  timeSlot: string
  isActive: boolean
  nextServiceDate?: string
  pricePerVisit: number
  startedAt: string
  cancelledAt?: string
}

export interface Review {
  id: string
  serviceRequestId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment?: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: string
  isRead: boolean
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface Transaction {
  id: string
  serviceRequestId: string
  amount: number
  currency: string
  method: TransactionMethod
  mpPaymentId?: string
  status: TransactionStatus
  createdAt: string
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
  address?: string
  latitude?: number
  longitude?: number
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
  workerServices: Array<
    WorkerService & {
      category: ServiceCategory
    }
  >
  distanceKm?: number
  estimatedArrivalMin?: number
}

export interface ServiceRequestWithDetails extends ServiceRequest {
  client?: ClientProfile & { user: Pick<User, 'firstName' | 'lastName' | 'avatarUrl' | 'phone'> }
  worker?: WorkerProfile & { user: Pick<User, 'firstName' | 'lastName' | 'avatarUrl' | 'phone'> }
  category?: ServiceCategory
  review?: Review
}

// ─── PRICE CALCULATION ────────────────────────────────────────────────────────

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
  type: ServiceType
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

export interface RequestStatusChange {
  requestId: string
  status: ServiceStatus
  updatedAt: string
}

export interface IncomingRequest {
  request: ServiceRequestWithDetails
  expiresAt: string
}

export interface ChatMessage {
  id: string
  requestId: string
  senderId: string
  senderName: string
  message: string
  timestamp: string
}
