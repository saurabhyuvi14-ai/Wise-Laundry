import { Router } from 'express'
import * as notificationsController from '../controllers/notifications.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()

router.use(requireAuth)
router.use(privateCacheControl)

router.get('/', notificationsController.listNotifications)
router.post('/seen', notificationsController.markSeen)

export default router
