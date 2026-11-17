import * as slotService from '../services/slot.service.js'

export async function listSlots(req, res, next) {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0]
    const slots = await slotService.getSlots(dateStr)
    return res.json({ data: slots })
  } catch (err) {
    next(err)
  }
}
