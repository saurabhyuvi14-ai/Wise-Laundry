import { Router } from 'express'
import { User } from '../models/User.js'
import { updateMeSchema, validate } from '../utils/validation.js'
import { requireAuth } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'

const router = Router()

// PATCH /api/v1/users/me
router.patch('/me', requireAuth, privateCacheControl, async (req, res, next) => {
  try {
    const data = validate(updateMeSchema, req.body)

    const user = await User.findById(req.user._id)
    if (data.fullName !== undefined) user.fullName = data.fullName
    if (data.phone !== undefined) user.phone = data.phone
    await user.save()

    return res.json({ data: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

export default router
