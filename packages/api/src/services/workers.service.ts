import { prisma } from '../config/prisma.js'
import { calculateDistance, estimateArrivalMinutes } from '@casapp/shared'

interface NearbyWorkersParams {
  lat: number
  lng: number
  categoryId?: string
  radius?: number // km, default 15
  limit?: number
}

export async function getNearbyWorkers(params: NearbyWorkersParams) {
  const { lat, lng, categoryId, radius = 15, limit = 20 } = params

  // Bounding box para filtrar antes del Haversine (optimización)
  const latDelta = radius / 111 // 1 grado lat ≈ 111 km
  const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180))

  const workers = await prisma.workerProfile.findMany({
    where: {
      isAvailable: true,
      currentLatitude: { gte: lat - latDelta, lte: lat + latDelta },
      currentLongitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      ...(categoryId
        ? {
            workerServices: {
              some: { categoryId, isActive: true },
            },
          }
        : {}),
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true },
      },
      workerServices: {
        where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
        include: { category: true },
      },
    },
    take: limit * 3, // fetch more to filter by exact distance
  })

  // Calcular distancia exacta, filtrar y aplicar ranking compuesto
  // Score = rating(50%) + proximidad(30%) + confianza/reviews(20%)
  const withDistance = workers
    .map((w) => {
      const dist = calculateDistance(lat, lng, w.currentLatitude!, w.currentLongitude!)
      const distanceKm = Math.round(dist * 10) / 10

      // Componentes del ranking (0–1 cada uno)
      const ratingScore = w.rating / 5
      const proximityScore = Math.min(1, 5 / Math.max(dist, 0.5)) // 5km = score 1, decreases
      const confidenceScore = Math.min(1, w.totalReviews / 20) // 20+ reviews = score 1
      const verifiedBonus = w.isVerified ? 0.1 : 0

      const rankScore =
        ratingScore * 0.5 + proximityScore * 0.3 + confidenceScore * 0.15 + verifiedBonus * 0.05

      return {
        ...w,
        distanceKm,
        estimatedArrivalMin: estimateArrivalMinutes(dist),
        rankScore: Math.round(rankScore * 100) / 100,
      }
    })
    .filter((w) => w.distanceKm <= radius)
    .sort((a, b) => b.rankScore - a.rankScore) // highest rank first
    .slice(0, limit)

  return withDistance
}

export async function getWorkerById(workerId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true },
      },
      workerServices: {
        where: { isActive: true },
        include: { category: true },
      },
    },
  })

  if (!worker) throw new Error('Trabajador no encontrado')
  return worker
}

export async function updateAvailability(userId: string, isAvailable: boolean) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.workerProfile.update({
    where: { userId },
    data: { isAvailable },
  })
}

export async function updateLocation(
  userId: string,
  latitude: number,
  longitude: number,
) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.workerProfile.update({
    where: { userId },
    data: { currentLatitude: latitude, currentLongitude: longitude },
  })
}

export async function getWorkerDashboard(userId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  })
  if (!worker) throw new Error('Perfil no encontrado')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [todayEarnings, weekEarnings, activeRequests, upcomingRequests] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        serviceRequest: { workerId: worker.id },
        status: 'APPROVED',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        serviceRequest: { workerId: worker.id },
        status: 'APPROVED',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    }),
    prisma.serviceRequest.findMany({
      where: {
        workerId: worker.id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
      },
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceRequest.findMany({
      where: {
        workerId: worker.id,
        status: 'MATCHED',
        type: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      include: { category: true },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    }),
  ])

  return {
    worker,
    todayEarnings: todayEarnings._sum.amount ?? 0,
    weekEarnings: weekEarnings._sum.amount ?? 0,
    activeRequests,
    upcomingRequests,
  }
}
