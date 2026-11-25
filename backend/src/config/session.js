import { config } from './env.js'

// How long a login lasts. Every visit pushes it forward again (see renewIfNeeded),
// so someone who uses the site at least once a month never has to log in again.
export const SESSION_DAYS = 30
export const SESSION_COOKIE_NAME = 'wise_session'

export const sessionCookieOptions = {
  httpOnly: true,
  secure: config?.NODE_ENV === 'production',
  sameSite: config?.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
}
