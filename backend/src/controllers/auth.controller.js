import * as authService from '../services/auth.service.js'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validate,
} from '../utils/validation.js'
import { config } from '../config/env.js'

const COOKIE_NAME = 'wise_session'
const cookieOptions = {
  httpOnly: true,
  secure: config?.NODE_ENV === 'production',
  sameSite: config?.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export async function register(req, res, next) {
  try {
    const data = validate(registerSchema, req.body)
    const { user, rawToken, verificationToken } = await authService.registerUser({
      ...data,
      req,
    })

    res.cookie(COOKIE_NAME, rawToken, cookieOptions)

    return res.status(201).json({
      data: user.toJSON(),
      meta: {
        verificationTokenNotice: config?.NODE_ENV !== 'production' ? verificationToken : undefined,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function login(req, res, next) {
  try {
    const data = validate(loginSchema, req.body)
    const { user, rawToken } = await authService.loginUser({ ...data, req })

    res.cookie(COOKIE_NAME, rawToken, cookieOptions)
    return res.json({ data: user.toJSON() })
  } catch (err) {
    next(err)
  }
}

export async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.slice(7)?.trim()
    await authService.logoutUser(rawToken)
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 })
    return res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function me(req, res) {
  return res.json({ data: req.user.toJSON() })
}

export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body
    const result = await authService.verifyEmail(token)
    return res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = validate(forgotPasswordSchema, req.body)
    const { resetToken } = await authService.forgotPassword(email)

    return res.json({
      data: {
        message: 'If an account exists with this email, password reset instructions have been sent.',
      },
      meta: {
        resetTokenNotice: config?.NODE_ENV !== 'production' && resetToken ? resetToken : undefined,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = validate(resetPasswordSchema, req.body)
    const result = await authService.resetPassword({ token, newPassword })
    return res.json({ data: result })
  } catch (err) {
    next(err)
  }
}
