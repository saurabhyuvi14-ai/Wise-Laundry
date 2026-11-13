import { Router } from 'express'
import { Address } from '../models/Address.js'
import { addressSchema, updateAddressSchema, validate } from '../utils/validation.js'
import { requireAuth, enforceOwnership } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'
import { ApiError } from '../utils/errors.js'

const router = Router()

// All address routes require authentication and private cache controls
router.use(requireAuth)
router.use(privateCacheControl)

// GET /api/v1/addresses
router.get('/', async (req, res, next) => {
  try {
    const list = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 })
    return res.json({ data: list.map((a) => a.toJSON()) })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/addresses
router.post('/', async (req, res, next) => {
  try {
    const data = validate(addressSchema, req.body)

    const count = await Address.countDocuments({ userId: req.user._id })
    const isFirst = count === 0
    const shouldBeDefault = data.isDefault || isFirst

    if (shouldBeDefault) {
      await Address.updateMany({ userId: req.user._id }, { isDefault: false })
    }

    const address = new Address({
      userId: req.user._id,
      label: data.label,
      recipientName: data.recipientName,
      phone: data.phone,
      landmark: data.landmark,
      city: data.city,
      postalCode: data.postalCode,
      isDefault: shouldBeDefault,
    })

    address.setSensitiveData({
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      instructions: data.instructions,
    })

    await address.save()
    return res.status(201).json({ data: address.toJSON() })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/addresses/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = validate(updateAddressSchema, req.body)
    const address = await Address.findById(req.params.id)

    if (!address) {
      throw ApiError.notFound('Address not found.')
    }

    enforceOwnership(address.userId, req.user._id)

    if (data.isDefault) {
      await Address.updateMany({ userId: req.user._id }, { isDefault: false })
      address.isDefault = true
    } else if (data.isDefault === false && address.isDefault) {
      // Keep at least one default if others exist
      address.isDefault = false
    }

    if (data.label) address.label = data.label
    if (data.recipientName) address.recipientName = data.recipientName
    if (data.phone) address.phone = data.phone
    if (data.landmark !== undefined) address.landmark = data.landmark
    if (data.city) address.city = data.city
    if (data.postalCode) address.postalCode = data.postalCode

    address.setSensitiveData({
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      instructions: data.instructions,
    })

    await address.save()
    return res.json({ data: address.toJSON() })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/addresses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const address = await Address.findById(req.params.id)
    if (!address) {
      throw ApiError.notFound('Address not found.')
    }

    enforceOwnership(address.userId, req.user._id)

    const wasDefault = address.isDefault
    await address.deleteOne()

    // If deleted address was default, promote another address to default
    if (wasDefault) {
      const nextDefault = await Address.findOne({ userId: req.user._id }).sort({ createdAt: -1 })
      if (nextDefault) {
        nextDefault.isDefault = true
        await nextDefault.save()
      }
    }

    return res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
