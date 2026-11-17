import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import { config, allowedOriginsList } from './config/env.js'
import { logger } from './config/logger.js'
import { csrfProtection } from './middleware/csrf.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { errorHandler } from './middleware/errorHandler.js'
import { ApiError } from './utils/errors.js'

import authRoutes from './routes/auth.routes.js'
import usersRoutes from './routes/users.routes.js'
import addressesRoutes from './routes/addresses.routes.js'
import catalogRoutes from './routes/catalog.routes.js'
import slotsRoutes from './routes/slots.routes.js'
import ordersRoutes from './routes/orders.routes.js'
import healthRoutes from './routes/health.routes.js'

const app = express()

// Trust proxy for rate limiting and secure cookies when behind Vite or reverse proxy
app.set('trust proxy', 1)

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: config?.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
)

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin / Vite proxy)
      if (!origin) return callback(null, true)
      if (allowedOriginsList.some((allowed) => allowed === origin || allowed === '*' || origin.startsWith(allowed))) {
        return callback(null, true)
      }
      return callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
    exposedHeaders: ['Idempotency-Key'],
  }),
)

// Request parsing
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(cookieParser())

// Structured request logging with redactions
if (config?.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }))
}

// Global API rate limiting & CSRF protection
app.use('/api', apiLimiter)
app.use('/api', csrfProtection)

// API v1 route mounting
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/addresses', addressesRoutes)
app.use('/api/v1/services', catalogRoutes)
app.use('/api/v1/catalog', catalogRoutes)
app.use('/api/v1/slots', slotsRoutes)
app.use('/api/v1/orders', ordersRoutes)
app.use('/api/v1/health', healthRoutes)

// Catch-all 404 for undefined API endpoints
app.use('/api', (_req, _res, next) => {
  next(ApiError.notFound('API endpoint not found.'))
})

// Centralized error handler
app.use(errorHandler)

export default app

