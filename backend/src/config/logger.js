import pino from 'pino'
import { config } from './env.js'

export const logger = pino({
  level: config?.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'req.body.password',
      'req.body.confirmPassword',
      'req.body.newPassword',
      'req.body.addressLine1',
      'req.body.addressLine2',
      'req.body.instructions',
      'req.body.coordinates',
      'req.body.lat',
      'req.body.lng',
      'coordinates',
      'lat',
      'lng',
      'latitude',
      'longitude',
      'coordinatesEncrypted',
      'password',
      'passwordHash',
      'emailVerificationToken',
      'passwordResetToken',
      'addressLine1Encrypted',
      'addressLine2Encrypted',
      'instructionsEncrypted',
      'addressSnapshot.addressLine1Encrypted',
      'addressSnapshot.addressLine2Encrypted',
      'addressSnapshot.instructionsEncrypted',
      'addressSnapshot.coordinatesEncrypted',
    ],
    censor: '[REDACTED]',
  },
})

