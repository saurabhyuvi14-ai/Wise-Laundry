import rateLimit from 'express-rate-limit'
import { config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'

export const apiLimiter = rateLimit({
  windowMs: config?.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: config?.NODE_ENV === 'test' ? 1000 : (config?.RATE_LIMIT_MAX_REQUESTS || 100),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.rateLimited('Too many requests to Wise Laundry API. Please try again later.'))
  },
})

export const authLimiter = rateLimit({
  windowMs: config?.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: config?.NODE_ENV === 'test' ? 1000 : (config?.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.rateLimited('Too many authentication attempts. Please try again after 15 minutes.'))
  },
})
