import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error('Unhandled error:', err)

  const statusCode = 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message

  return res.status(statusCode).json({
    success: false,
    error: message,
  })
}
