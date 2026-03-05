import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, type JwtPayload } from '../utils/jwt.js'
import { sendError } from '../utils/response.js'

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 'No token provided', 401)
  }

  const token = authHeader.slice(7)
  try {
    req.user = verifyAccessToken(token)
    return next()
  } catch {
    return sendError(res, 'Invalid or expired token', 401)
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return sendError(res, 'Not authenticated', 401)
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403)
    }
    return next()
  }
}
