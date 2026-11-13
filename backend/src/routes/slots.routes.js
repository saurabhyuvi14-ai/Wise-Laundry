import { Router } from 'express'
import { SlotCapacity } from '../models/SlotCapacity.js'
import { config } from '../config/env.js'

const router = Router()

const STANDARD_SLOTS = [8, 10, 12, 14, 16, 18, 20]

// GET /api/v1/slots
router.get('/', async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0]
    const slots = await Promise.all(
      STANDARD_SLOTS.map((hour) => SlotCapacity.getSlotAvailability(dateStr, hour, config.DEFAULT_SLOT_CAPACITY)),
    )
    return res.json({ data: slots })
  } catch (err) {
    next(err)
  }
})

export default router
