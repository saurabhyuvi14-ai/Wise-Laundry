import { Router } from 'express'
import { User } from '../models/User.js'
import { Session } from '../models/Session.js'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validate,
} from '../utils/validation.js'
import { ApiError } from '../utils/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'
import { privateCacheControl } from '../middleware/cacheControl.js'
import { generateSecureToken, hashToken } from '../utils/crypto.js'
import { config } from '../config/env.js'

const router = Router()

const COOKIE_NAME = 'wise_session'
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

// POST /api/v1/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = validate(registerSchema, req.body)

    const existing = await User.findOne({ email: data.email })
    if (existing) {
      throw ApiError.conflict('An account with this email already exists.', {
        email: 'An account with this email already exists.',
      })
    }

    const passwordHash = await User.hashPassword(data.password)
    const verificationToken = generateSecureToken(24)

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: 'CUSTOMER',
      isEmailVerified: false,
      emailVerificationToken: hashToken(verificationToken),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })

    const { rawToken } = await Session.createSession(user._id, req)
    res.cookie(COOKIE_NAME, rawToken, cookieOptions)

    return res.status(201).json({
      data: user.toJSON(),
      meta: {
        verificationTokenNotice: config.NODE_ENV !== 'production' ? verificationToken : undefined,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = validate(loginSchema, req.body)

    const user = await User.findOne({ email })
    if (!user) {
      throw ApiError.badRequest('Invalid email or password.')
    }

    const valid = await user.verifyPassword(password)
    if (!valid) {
      throw ApiError.badRequest('Invalid email or password.')
    }

    const { rawToken } = await Session.createSession(user._id, req)
    res.cookie(COOKIE_NAME, rawToken, cookieOptions)

    return res.json({ data: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.slice(7)?.trim()
    if (rawToken) {
      await Session.revokeSession(rawToken)
    }
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 })
    return res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/auth/me
router.get('/me', requireAuth, privateCacheControl, (req, res) => {
  return res.json({ data: req.user.toJSON() })
})

// POST /api/v1/auth/verify-email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body
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

    return res.json({ data: { message: 'Email verified successfully.' } })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = validate(forgotPasswordSchema, req.body)
    const user = await User.findOne({ email })

    // Generic response to avoid account enumeration
    const genericResponse = {
      data: { message: 'If an account exists with this email, password reset instructions have been sent.' },
    }

    if (!user) {
      return res.json(genericResponse)
    }

    const resetToken = generateSecureToken(32)
    user.passwordResetToken = hashToken(resetToken)
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await user.save()

    return res.json({
      ...genericResponse,
      meta: {
        resetTokenNotice: config.NODE_ENV !== 'production' ? resetToken : undefined,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = validate(resetPasswordSchema, req.body)
    const tokenHash = hashToken(token)

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    })

    if (!user) {
      throw ApiError.badRequest('Invalid or expired password reset token.')
    }

    user.passwordHash = await User.hashPassword(newPassword)
    user.passwordResetToken = null
    user.passwordResetExpires = null
    await user.save()

    // Revoke all existing sessions for security
    await Session.revokeAllUserSessions(user._id)

    return res.json({ data: { message: 'Password has been reset successfully. Please log in with your new password.' } })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/auth/csrf
router.get('/csrf', (req, res) => {
  const token = req.cookies?.wise_csrf_token || generateSecureToken(16)
  return res.json({ data: { csrfToken: token } })
})

export default router
