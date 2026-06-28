import { prisma } from '../config/prisma.js'
import { calculateDistance } from '@casapp/shared'

interface BrowseParams {
  lat?: number
  lng?: number
  radius?: number
}

export async function browseRentals(params: BrowseParams) {
  const { lat, lng, radius = 30 } = params

  const items = await prisma.workerEquipment.findMany({
    where: { isForRent: true, pricePerDayCents: { not: null } },
    include: {
      worker: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (lat == null || lng == null) return items.map((i) => ({ ...i, distanceKm: null }))

  return items
    .map((i) => {
      const distanceKm =
        i.worker.currentLatitude != null && i.worker.currentLongitude != null
          ? Math.round(calculateDistance(lat, lng, i.worker.currentLatitude, i.worker.currentLongitude) * 10) / 10
          : null
      return { ...i, distanceKm }
    })
    .filter((i) => i.distanceKm == null || i.distanceKm <= radius)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
}

export async function getOwnEquipment(workerUserId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.workerEquipment.findMany({
    where: { workerId: worker.id },
    orderBy: { createdAt: 'desc' },
  })
}

export async function setRentalSettings(
  workerUserId: string,
  equipmentId: string,
  data: { isForRent: boolean; pricePerDayCents?: number },
) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  const equipment = await prisma.workerEquipment.findUnique({ where: { id: equipmentId } })
  if (!equipment || equipment.workerId !== worker.id) throw new Error('Equipo no encontrado')

  if (data.isForRent && !data.pricePerDayCents) {
    throw new Error('Definí un precio por día para ofrecerlo en alquiler')
  }

  return prisma.workerEquipment.update({
    where: { id: equipmentId },
    data: { isForRent: data.isForRent, pricePerDayCents: data.pricePerDayCents },
  })
}

export async function createRental(
  renterId: string,
  data: { equipmentId: string; startDate: Date; endDate: Date },
) {
  const equipment = await prisma.workerEquipment.findUnique({ where: { id: data.equipmentId } })
  if (!equipment || !equipment.isForRent || !equipment.pricePerDayCents) {
    throw new Error('Esta máquina no está disponible para alquiler')
  }
  if (data.endDate <= data.startDate) throw new Error('La fecha de fin debe ser posterior a la de inicio')

  const totalDays = Math.ceil((data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24))
  const totalPriceCents = totalDays * equipment.pricePerDayCents

  const overlapping = await prisma.equipmentRental.findFirst({
    where: {
      equipmentId: data.equipmentId,
      status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
      startDate: { lt: data.endDate },
      endDate: { gt: data.startDate },
    },
  })
  if (overlapping) throw new Error('La máquina ya está reservada en esas fechas')

  return prisma.equipmentRental.create({
    data: {
      equipmentId: data.equipmentId,
      renterId,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
      totalPriceCents,
    },
    include: { equipment: true },
  })
}

export async function getMyRentals(renterId: string) {
  return prisma.equipmentRental.findMany({
    where: { renterId },
    include: { equipment: { include: { worker: { include: { user: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOwnerRentals(workerUserId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  return prisma.equipmentRental.findMany({
    where: { equipment: { workerId: worker.id } },
    include: { equipment: true, renter: { select: { firstName: true, lastName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateRentalStatus(
  workerUserId: string,
  rentalId: string,
  status: 'CONFIRMED' | 'CANCELLED' | 'ACTIVE' | 'COMPLETED',
) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId: workerUserId } })
  if (!worker) throw new Error('Perfil de trabajador no encontrado')

  const rental = await prisma.equipmentRental.findUnique({
    where: { id: rentalId },
    include: { equipment: true },
  })
  if (!rental || rental.equipment.workerId !== worker.id) throw new Error('Reserva no encontrada')

  return prisma.equipmentRental.update({ where: { id: rentalId }, data: { status } })
}
