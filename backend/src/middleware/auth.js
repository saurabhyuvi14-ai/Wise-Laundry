import { Session } from '../models/Session.js'
import { ApiError } from '../utils/errors.js'

export async function requireAuth(req, _res, next) {
  try {
    const rawToken = req.cookies?.wise_session || extractBearerToken(req.headers.authorization)

    if (!rawToken) {
      throw ApiError.unauthenticated('Please sign in to continue.')
    }

    const session = await Session.validateSession(rawToken)
    if (!session || !session.userId) {
      throw ApiError.unauthenticated('Your session has expired or is invalid. Please sign in again.')
    }

    req.user = session.userId
    req.session = session
    req.sessionToken = rawToken
    next()
  } catch (err) {
    next(err)
  }
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthenticated())
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires ${allowedRoles.join(' or ')} permission.`))
    }
    next()
  }
}

export function enforceOwnership(resourceUserId, currentUserId) {
  const resourceIdStr = resourceUserId?.toString()
  const currentIdStr = currentUserId?._id ? currentUserId._id.toString() : currentUserId?.toString()
  if (resourceIdStr !== currentIdStr) {
    throw ApiError.forbidden('You do not have permission to access or modify this record.')
  }
}

function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

