import { OAuth2Client } from 'google-auth-library'
import { config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'
import { logger } from '../config/logger.js'

const client = new OAuth2Client()

/**
 * Checks the ID token ("credential") that Google gives the browser after the user picks an account.
 * Google signs it, so the email inside can be trusted once the signature, audience and expiry check out.
 * Tests replace `googleVerifier.verifyIdToken` so they never call Google.
 */
export const googleVerifier = {
  async verifyIdToken(idToken, audience) {
    const ticket = await client.verifyIdToken({ idToken, audience })
    return ticket.getPayload()
  },
}

export async function verifyGoogleCredential(credential) {
  if (!config.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not set up yet.')
  }

  let payload
  try {
    payload = await googleVerifier.verifyIdToken(credential, config.GOOGLE_CLIENT_ID)
  } catch (err) {
    throw explainGoogleError(err)
  }

  if (!payload?.sub || !payload.email) {
    throw ApiError.unauthenticated('Google sign-in failed. Please try again.')
  }
  if (payload.email_verified !== true) {
    throw ApiError.badRequest('This Google account has no verified email.')
  }

  const email = payload.email.trim().toLowerCase()
  return {
    googleId: payload.sub,
    email,
    fullName: (payload.name || email.split('@')[0]).trim().slice(0, 100),
  }
}

// Turns Google's error into a clear reason, so a setup mistake is easy to spot. Client IDs are public.
function explainGoogleError(err) {
  const reason = String(err?.message || err)
  logger.warn({ reason }, 'Google sign-in rejected')

  if (/audience|recipient/i.test(reason)) {
    return new ApiError(401, 'GOOGLE_CLIENT_ID_MISMATCH', 'Google sign-in is set up with a different Client ID on the server. Check GOOGLE_CLIENT_ID on the backend.')
  }
  if (/expired|too late|too early|used too/i.test(reason)) {
    return new ApiError(401, 'GOOGLE_TOKEN_EXPIRED', 'Your Google sign-in expired. Please try again.')
  }
  if (/certificate|certs|fetch|network|socket|timeout|ENOTFOUND|ECONN|EAI_AGAIN/i.test(reason)) {
    return new ApiError(503, 'GOOGLE_UNREACHABLE', 'We could not reach Google right now. Please try again shortly.')
  }
  return new ApiError(401, 'GOOGLE_TOKEN_INVALID', 'Google sign-in failed. Please try again.')
}
