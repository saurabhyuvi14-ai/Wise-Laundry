import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()

router.post('/register', authLimiter, authController.register)
router.post('/login', authLimiter, authController.login)
router.post('/google', authLimiter, authController.googleSignIn)
router.post('/logout', authController.logout)
router.get('/me', requireAuth, privateCacheControl, authController.me)
router.post('/verify-email', authController.verifyEmail)
router.post('/forgot-password', authLimiter, authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)

export default router

