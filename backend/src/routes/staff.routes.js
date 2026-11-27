import { Router } from 'express'
import * as staffController from '../controllers/staff.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

// Team tools. Riders get their own jobs; staff and admin get everything; admin also manages the team.
const router = Router()
const staff = requireRole('STAFF', 'ADMIN')

router.use(requireAuth)
router.use(requireRole('RIDER', 'STAFF', 'ADMIN'))
router.use(privateCacheControl)

router.get('/work', staffController.getWorkList)
router.post('/orders/:id/status', staffController.advanceStatus)

router.get('/riders', staff, staffController.listRiders)
router.get('/orders/:id', staff, staffController.getOrder)
router.post('/orders/:id/bill', staff, staffController.saveBill)
router.post('/orders/:id/rider', staff, staffController.assignRider)

router.get('/team', requireRole('ADMIN'), staffController.listTeam)
router.post('/team', requireRole('ADMIN'), staffController.setRole)

export default router
