import pino from 'pino'
import { config } from './env.js'

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'req.body.confirmPassword',
      'password',
      'confirmPassword',
      'token',
      'tokenHash',
      'addressLine1',
      'addressLine2',
      'instructions',
      'phone',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
