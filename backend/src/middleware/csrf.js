import { allowedOriginsList, config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'
import { generateSecureToken } from '../utils/crypto.js'

const MUTATIVE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function csrfProtection(req, res, next) {
  // 1. Ensure a CSRF token cookie is present for the client to read
  let csrfToken = req.cookies?.wise_csrf_token
  if (!csrfToken) {
    csrfToken = generateSecureToken(16)
    res.cookie('wise_csrf_token', csrfToken, {
      httpOnly: false, // client JS must be able to read this cookie to send in X-CSRF-Token header
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }

  // Safe HTTP methods (GET, HEAD, OPTIONS) do not require CSRF origin validation
  if (!MUTATIVE_METHODS.has(req.method.toUpperCase())) {
    return next()
  }

  // In test mode, allow tests unless explicitly testing CSRF rejection
  if (config.NODE_ENV === 'test' && req.headers['x-test-bypass-csrf']) {
    return next()
  }

  // 2. Validate Origin / Referer header
  const origin = req.headers.origin || (req.headers.referer ? extractOrigin(req.headers.referer) : null)

  // In production / non-test, mutative requests with an origin must be verified
  if (origin) {
    const isOriginAllowed = allowedOriginsList.some(
      (allowed) => allowed === origin || allowed === '*' || origin.startsWith(allowed),
    )
    if (!isOriginAllowed) {
      return next(ApiError.forbidden(`Cross-Site Request Blocked: Origin '${origin}' is not permitted.`))
    }
  }

  // 3. Double Submit Cookie check: if client supplied x-csrf-token, verify match
  const headerToken = req.headers['x-csrf-token']
  if (headerToken && csrfToken && headerToken !== csrfToken) {
    return next(ApiError.forbidden('CSRF token mismatch.'))
  }

  next()
}

function extractOrigin(referer) {
  try {
    const url = new URL(referer)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}
