import { OAuth2Client } from 'google-auth-library'
import { config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'

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
  } catch {
    throw ApiError.unauthenticated('Google sign-in failed. Please try again.')
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
