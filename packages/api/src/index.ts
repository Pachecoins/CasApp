import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import rateLimit from 'express-rate-limit'

import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.routes.js'
import categoriesRoutes from './routes/categories.routes.js'

const app = express()
const httpServer = createServer(app)

// ─── Socket.IO Setup ──────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [env.CLIENT_APP_URL, env.WORKER_APP_URL],
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`)

  socket.on('worker:location-update', (data) => {
    socket.broadcast.emit('worker:location-update', data)
  })

  socket.on('join-request-room', (requestId: string) => {
    socket.join(`request:${requestId}`)
  })

  socket.on('chat:message', (data) => {
    io.to(`request:${data.requestId}`).emit('chat:message', data)
  })

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`)
  })
})

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet())
app.use(
  cors({
    origin: [env.CLIENT_APP_URL, env.WORKER_APP_URL],
    credentials: true,
  }),
)
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts, please try again later' },
})
app.use('/api/auth', authLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoriesRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// Error handler (must be last)
app.use(errorHandler)

// ─── Start Server ─────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`
🏠 CasApp API running!
   → http://localhost:${env.PORT}
   → Environment: ${env.NODE_ENV}
   → Health: http://localhost:${env.PORT}/health
  `)
})

export default app
