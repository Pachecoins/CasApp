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
import { prisma } from './config/prisma.js'
import authRoutes from './routes/auth.routes.js'
import categoriesRoutes from './routes/categories.routes.js'
import workersRoutes from './routes/workers.routes.js'
import requestsRoutes, { clientRequestsRouter } from './routes/requests.routes.js'
import reviewsRoutes from './routes/reviews.routes.js'
import chatRoutes from './routes/chat.routes.js'
import paymentsRoutes from './routes/payments.routes.js'
import subscriptionsRoutes from './routes/subscriptions.routes.js'
import profilesRoutes from './routes/profiles.routes.js'
import notificationsRoutes from './routes/notifications.routes.js'
import adminRoutes from './routes/admin.routes.js'
import assistantRoutes from './routes/assistant.routes.js'
import equipmentRoutes from './routes/equipment.routes.js'
import productsRoutes from './routes/products.routes.js'
import coursesRoutes from './routes/courses.routes.js'
import { generateScheduledRequests } from './services/subscriptions.service.js'
import { autoReleaseOverdueOrders } from './services/escrow.service.js'
import cron from 'node-cron'

const app = express()
const httpServer = createServer(app)

// ─── Socket.IO ───────────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [env.CLIENT_APP_URL, env.WORKER_APP_URL],
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`)

  // Personal rooms
  socket.on('identify', (data: { userId: string; role: string }) => {
    if (data.role === 'WORKER') socket.join(`worker:${data.userId}`)
    if (data.role === 'CLIENT') socket.join(`client:${data.userId}`)
  })

  // Join request room
  socket.on('join-request-room', (requestId: string) => {
    socket.join(`request:${requestId}`)
  })

  // GPS update → broadcast to request room only
  socket.on('worker:location-update', (data: { workerId: string; lat: number; lng: number; requestId?: string }) => {
    if (data.requestId) {
      io.to(`request:${data.requestId}`).emit('worker:location-update', data)
    }
  })

  // Chat message → broadcast + persist to DB
  socket.on('chat:message', async (data: { requestId: string; senderId: string; senderName: string; message: string }) => {
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    const fullMsg = { ...data, id, timestamp }
    io.to(`request:${data.requestId}`).emit('chat:message', fullMsg)

    // Persist asynchronously — don't block the emit
    prisma.chatMessage.create({
      data: {
        id,
        serviceRequestId: data.requestId,
        senderId: data.senderId,
        senderName: data.senderName,
        message: data.message,
        createdAt: new Date(timestamp),
      },
    }).catch((err) => console.error('[Chat] Failed to persist message:', err))
  })

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`)
  })
})

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: [env.CLIENT_APP_URL, env.WORKER_APP_URL], credentials: true }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false })
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts' },
})
app.use('/api/auth', authLimiter)

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/workers', workersRoutes)
app.use('/api/requests', requestsRoutes)
app.use('/api/clients', clientRequestsRouter)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/subscriptions', subscriptionsRoutes)
app.use('/api/profiles', profilesRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/assistant', assistantRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/courses', coursesRoutes)

app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }))
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`
🏠 Tuki API running!
   → http://localhost:${env.PORT}
   → Environment: ${env.NODE_ENV}
   → Health: http://localhost:${env.PORT}/health
  `)

  // ─── Cron: check subscriptions every 30 minutes ──────────────────────────
  cron.schedule('*/30 * * * *', () => {
    generateScheduledRequests().catch((err) =>
      console.error('[Cron] Subscription job failed:', err),
    )
  })
  console.log('[Cron] Subscription scheduler started (every 30 min)')

  // ─── Cron: auto-release escrow after 24h (2c) ─────────────────────────────
  // Runs every hour; releases orders in FINISHED_PENDING_APPROVAL older than 24h
  cron.schedule('0 * * * *', () => {
    autoReleaseOverdueOrders().catch((err) =>
      console.error('[Cron] Escrow auto-release failed:', err),
    )
  })
  console.log('[Cron] Escrow auto-release started (every hour)')
})

export default app
