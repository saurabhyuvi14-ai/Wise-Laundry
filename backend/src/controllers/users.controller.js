import { User } from '../models/User.js'
import { updateMeSchema, validate } from '../utils/validation.js'

export async function updateMe(req, res, next) {
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
}

