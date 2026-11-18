import { User } from '../models/User.js'
import { Session } from '../models/Session.js'
import { ApiError } from '../utils/errors.js'
import { generateSecureToken, hashToken } from '../utils/crypto.js'
import { verifyGoogleCredential } from './google.service.js'

export async function registerUser({ fullName, email, phone, password, req }) {
  const existing = await User.findOne({ email })
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.', {
      email: 'An account with this email already exists.',
    })
  }

  const passwordHash = await User.hashPassword(password)
  const verificationToken = generateSecureToken(24)

  const user = await User.create({
    fullName,
    email,
    phone,
    passwordHash,
    role: 'CUSTOMER',
    isEmailVerified: false,
    emailVerificationToken: hashToken(verificationToken),
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  })

  const { rawToken } = await Session.createSession(user._id, req)
  return { user, rawToken, verificationToken }
}

export async function loginUser({ email, password, req }) {
  const user = await User.findOne({ email })
  if (!user) {
    throw ApiError.badRequest('Invalid email or password.')
  }

  const valid = await user.verifyPassword(password)
  if (!valid) {
    throw ApiError.badRequest('Invalid email or password.')
  }

  const { rawToken } = await Session.createSession(user._id, req)
  return { user, rawToken }
}

/**
 * Sign in with Google. Google has already checked the email, so it is marked verified.
 * - Known Google account or known email: signs in (and links the Google account).
 * - New person without a phone number: returns needsPhone so the frontend can ask for it.
 * - New person with a phone number: creates the customer and signs in.
 */
export async function googleSignIn({ credential, phone, req }) {
  const profile = await verifyGoogleCredential(credential)

  let user = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] })

  if (user) {
    let changed = false
    if (!user.googleId) {
      user.googleId = profile.googleId
      changed = true
    }
    if (!user.isEmailVerified) {
      user.isEmailVerified = true
      user.emailVerificationToken = null
      user.emailVerificationExpires = null
      changed = true
    }
    if (changed) await user.save()
  } else {
    if (!phone) {
      return { needsPhone: true, profile: { fullName: profile.fullName, email: profile.email } }
    }
    user = await User.create({
      fullName: profile.fullName,
      email: profile.email,
      phone,
      googleId: profile.googleId,
      role: 'CUSTOMER',
      isEmailVerified: true,
    })
  }

  const { rawToken } = await Session.createSession(user._id, req)
  return { user, rawToken, needsPhone: false }
}

export async function logoutUser(rawToken) {
  if (rawToken) {
    await Session.revokeSession(rawToken)
  }
}

export async function verifyEmail(token) {
  if (!token) throw ApiError.badRequest('Verification token is required.')

  const tokenHash = hashToken(token)
  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  })

  if (!user) {
    throw ApiError.badRequest('Invalid or expired verification token.')
  }

  user.isEmailVerified = true
  user.emailVerificationToken = null
  user.emailVerificationExpires = null
  await user.save()

  return { message: 'Email verified successfully.' }
}

export async function forgotPassword(email) {
  const user = await User.findOne({ email })
  let resetToken = null

  if (user) {
    resetToken = generateSecureToken(24)
    user.passwordResetToken = hashToken(resetToken)
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await user.save()
  }

  return { resetToken }
}

export async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token)
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  })

  if (!user) {
    throw ApiError.badRequest('Invalid or expired reset token.')
  }

  user.passwordHash = await User.hashPassword(newPassword)
  user.passwordResetToken = null
  user.passwordResetExpires = null
  await user.save()

  // Revoke all existing sessions for security
  await Session.revokeAllUserSessions(user._id)

  return { message: 'Password has been reset successfully. Please log in with your new password.' }
}

