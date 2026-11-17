import { User } from '../models/User.js'
import { Session } from '../models/Session.js'
import { ApiError } from '../utils/errors.js'
import { generateSecureToken, hashToken } from '../utils/crypto.js'

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

