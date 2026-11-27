import { Router } from 'express'
import * as pushController from '../controllers/push.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()
router.use(requireAuth)
router.use(privateCacheControl)

router.get('/key', pushController.getKey)
router.post('/subscribe', pushController.subscribe)
router.post('/unsubscribe', pushController.unsubscribe)

export default router
