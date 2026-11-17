import { Router } from 'express'
import * as usersController from '../controllers/users.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()

router.patch('/me', requireAuth, privateCacheControl, usersController.updateMe)

export default router

