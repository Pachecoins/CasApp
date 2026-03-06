import { prisma } from '../config/prisma.js'
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js'
import crypto from 'crypto'

// ─── Public worker profile ────────────────────────────────────────────────────

export async function getWorkerPublicProfile(workerUserId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { userId: workerUserId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
      workerServices: {
        where: { isActive: true },
        include: { category: { select: { name: true, slug: true } } },
      },
    },
  })

  if (!worker) throw new Error('Perfil no encontrado')

  // Reviews for this worker
  const reviews = await prisma.review.findMany({
    where: { revieweeId: workerUserId },
    include: {
      reviewer: { select: { firstName: true, lastName: true, avatarUrl: true } },
      serviceRequest: { include: { category: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Completed jobs count
  const completedJobs = await prisma.serviceRequest.count({
    where: { worker: { userId: workerUserId }, status: 'COMPLETED' },
  })

  return { ...worker, reviews, completedJobs }
}

// ─── Update worker bio / profile ─────────────────────────────────────────────

export async function updateWorkerProfile(
  userId: string,
  data: { bio?: string; radiusKm?: number },
) {
  const profile = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!profile) throw new Error('Perfil no encontrado')

  return prisma.workerProfile.update({
    where: { userId },
    data: {
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.radiusKm !== undefined && { radiusKm: data.radiusKm }),
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      workerServices: { where: { isActive: true }, include: { category: true } },
    },
  })
}

// ─── Upload avatar ────────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, fileBuffer: Buffer, mimetype: string) {
  let avatarUrl: string

  if (isCloudinaryConfigured) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'casapp/avatars',
          public_id: `user_${userId}`,
          overwrite: true,
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        },
        (err, result) => {
          if (err || !result) reject(err ?? new Error('Upload failed'))
          else resolve(result as { secure_url: string })
        },
      )
      uploadStream.end(fileBuffer)
    })
    avatarUrl = result.secure_url
  } else {
    // Dev mode: store as data URI (not recommended for prod, but works for testing)
    avatarUrl = `data:${mimetype};base64,${fileBuffer.toString('base64').slice(0, 100)}...`
    // More useful: just use a placeholder Gravatar
    const hash = crypto.createHash('md5').update(userId).digest('hex')
    avatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=400`
  }

  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } })
  return { avatarUrl }
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioItem {
  id: string
  url: string
  caption?: string
  uploadedAt: string
}

export async function addPortfolioItem(
  userId: string,
  categoryId: string,
  fileBuffer: Buffer,
  mimetype: string,
  caption?: string,
) {
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!workerProfile) throw new Error('Perfil no encontrado')

  const workerService = await prisma.workerService.findFirst({
    where: { workerId: workerProfile.id, categoryId, isActive: true },
  })
  if (!workerService) throw new Error('Servicio no encontrado en tu perfil')

  const itemId = crypto.randomUUID()
  let imageUrl: string

  if (isCloudinaryConfigured) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `casapp/portfolio/${workerProfile.id}`,
          public_id: itemId,
          transformation: [{ width: 800, height: 600, crop: 'fill' }],
        },
        (err, result) => {
          if (err || !result) reject(err ?? new Error('Upload failed'))
          else resolve(result as { secure_url: string })
        },
      )
      stream.end(fileBuffer)
    })
    imageUrl = result.secure_url
  } else {
    const hash = crypto.createHash('md5').update(itemId).digest('hex')
    imageUrl = `https://picsum.photos/seed/${hash}/800/600`
  }

  const current = (workerService.portfolio ?? []) as PortfolioItem[]
  const newItem: PortfolioItem = {
    id: itemId,
    url: imageUrl,
    caption,
    uploadedAt: new Date().toISOString(),
  }
  const updated = [...current, newItem]

  await prisma.workerService.update({
    where: { id: workerService.id },
    data: { portfolio: updated },
  })

  return newItem
}

export async function removePortfolioItem(
  userId: string,
  categoryId: string,
  itemId: string,
) {
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } })
  if (!workerProfile) throw new Error('Perfil no encontrado')

  const workerService = await prisma.workerService.findFirst({
    where: { workerId: workerProfile.id, categoryId, isActive: true },
  })
  if (!workerService) throw new Error('Servicio no encontrado')

  const current = (workerService.portfolio ?? []) as PortfolioItem[]
  const item = current.find((i) => i.id === itemId)
  if (!item) throw new Error('Imagen no encontrada')

  // Delete from Cloudinary if configured
  if (isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(`casapp/portfolio/${workerProfile.id}/${itemId}`).catch(() => {})
  }

  const updated = current.filter((i) => i.id !== itemId)
  await prisma.workerService.update({
    where: { id: workerService.id },
    data: { portfolio: updated },
  })

  return { removed: itemId }
}

// ─── Own profile (worker view) ────────────────────────────────────────────────

export async function getOwnProfile(userId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, phone: true, createdAt: true } },
      workerServices: {
        where: { isActive: true },
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  })
  if (!worker) throw new Error('Perfil no encontrado')

  const completedJobs = await prisma.serviceRequest.count({
    where: { worker: { userId }, status: 'COMPLETED' },
  })

  const reviews = await prisma.review.findMany({
    where: { revieweeId: userId },
    include: { reviewer: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return { ...worker, completedJobs, reviews }
}
