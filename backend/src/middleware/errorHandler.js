import { ApiError } from '../utils/errors.js'
import { logger } from '../config/logger.js'

export function errorHandler(err, _req, res, _next) {
  // 1. ApiError
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        fields: Object.keys(err.fields).length > 0 ? err.fields : undefined,
      },
    })
  }

  // 2. Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'record'
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `A ${field} with this value already exists.`,
        fields: { [field]: `This ${field} is already in use.` },
      },
    })
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid resource identifier provided.',
      },
    })
  }

  // 4. Unexpected server error
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled API error')
  return res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  })
}

