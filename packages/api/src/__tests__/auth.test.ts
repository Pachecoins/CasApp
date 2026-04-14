import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'

// Mock env
vi.mock('../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-testing-purposes',
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 3000,
    CLIENT_APP_URL: 'http://localhost:5173',
    WORKER_APP_URL: 'http://localhost:5174',
    PLATFORM_COMMISSION: 0.15,
  },
}))

describe('JWT Utils', () => {
  const payload = {
    userId: 'user-123',
    role: 'CLIENT',
    email: 'test@example.com',
  }

  it('should sign and verify access token', () => {
    const token = signAccessToken(payload)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')

    const decoded = verifyAccessToken(token)
    expect(decoded.userId).toBe(payload.userId)
    expect(decoded.role).toBe(payload.role)
    expect(decoded.email).toBe(payload.email)
  })

  it('should sign and verify refresh token', () => {
    const token = signRefreshToken(payload)
    expect(token).toBeTruthy()

    const decoded = verifyRefreshToken(token)
    expect(decoded.userId).toBe(payload.userId)
  })

  it('should throw on invalid access token', () => {
    expect(() => verifyAccessToken('invalid-token')).toThrow()
  })

  it('should throw on invalid refresh token', () => {
    expect(() => verifyRefreshToken('invalid-token')).toThrow()
  })

  it('should not verify access token with refresh secret', () => {
    const accessToken = signAccessToken(payload)
    expect(() => verifyRefreshToken(accessToken)).toThrow()
  })
})

