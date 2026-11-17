import { Router } from 'express'
import * as addressesController from '../controllers/addresses.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()

router.use(requireAuth)
router.use(privateCacheControl)

router.get('/', addressesController.listAddresses)
router.post('/', addressesController.createAddress)
router.patch('/:id', addressesController.updateAddress)
router.delete('/:id', addressesController.deleteAddress)

export default router
