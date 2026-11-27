import { Router } from 'express'
import * as ordersController from '../controllers/orders.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()

router.use(requireAuth)
router.use(privateCacheControl)

router.post('/', ordersController.createOrder)
router.get('/', ordersController.listOrders)
router.get('/:id', ordersController.getOrder)
router.get('/:id/tracking', ordersController.getTracking)
router.post('/:id/cancel', ordersController.cancelOrder)
router.post('/:id/reschedule', ordersController.rescheduleOrder)
router.post('/:id/feedback', ordersController.submitFeedback)
router.post('/:id/express', ordersController.setExpress)
router.post('/:id/pay', ordersController.markPaid)
router.post('/:id/advance', ordersController.advanceOrder)

export default router

