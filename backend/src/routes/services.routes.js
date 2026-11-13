import { Router } from 'express'
import { Service } from '../models/Service.js'

const router = Router()

// GET /api/v1/services
router.get('/', async (_req, res, next) => {
  try {
    const list = await Service.find({ active: true }).sort({ unitPricePaise: 1 })
    return res.json({ data: list.map((s) => s.toJSON()) })
  } catch (err) {
    next(err)
  }
})

export default router
