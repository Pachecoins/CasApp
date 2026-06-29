import bcrypt from 'bcrypt'
import { prisma } from '../config/prisma.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
import type {
  RegisterClientPayload,
  RegisterWorkerPayload,
  LoginPayload,
  AuthResponse,
} from '@tuki/shared'

const SALT_ROUNDS = 12

export async function registerClient(payload: RegisterClientPayload): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: payload.email } })
  if (existing) throw new Error('Email already registered')

  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      role: 'CLIENT',
      clientProfile: {
        create: {
          address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
      },
    },
    include: { clientProfile: true },
  })

  const tokenPayload = { userId: user.id, role: user.role, email: user.email }

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  }
}

export async function registerWorker(payload: RegisterWorkerPayload): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: payload.email } })
  if (existing) throw new Error('Email already registered')

  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      role: 'WORKER',
      workerProfile: {
        create: {
          bio: payload.bio,
          radiusKm: payload.radiusKm ?? 10,
        },
      },
    },
    include: { workerProfile: true },
  })

  // Link selected service categories
  if (payload.categoryIds?.length && user.workerProfile) {
    const workerId = user.workerProfile.id
    await prisma.workerService.createMany({
      data: payload.categoryIds.map((categoryId) => ({
        workerId,
        categoryId,
      })),
    })
  }

  const tokenPayload = { userId: user.id, role: user.role, email: user.email }

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  }
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: payload.email } })
  if (!user) throw new Error('Invalid email or password')

  const isValid = await bcrypt.compare(payload.password, user.passwordHash)
  if (!isValid) throw new Error('Invalid email or password')

  const tokenPayload = { userId: user.id, role: user.role, email: user.email }

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  }
}

export async function refreshToken(token: string): Promise<{ accessToken: string }> {
  const payload = verifyRefreshToken(token)

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw new Error('User not found')

  const newPayload = { userId: user.id, role: user.role, email: user.email }

  return { accessToken: signAccessToken(newPayload) }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      clientProfile: true,
      workerProfile: {
        include: {
          workerServices: {
            include: { category: true },
            where: { isActive: true },
          },
        },
      },
    },
  })

  if (!user) throw new Error('User not found')
  return user
}
