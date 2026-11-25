import { Router } from 'express'
import * as staffController from '../controllers/staff.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

// Staff-only tools. Make someone staff with: npm run make-staff -- their@email.com
const router = Router()

router.use(requireAuth)
router.use(requireRole('STAFF', 'ADMIN'))
router.use(privateCacheControl)

router.get('/orders/:id', staffController.getOrder)
router.post('/orders/:id/bill', staffController.saveBill)

export default router
