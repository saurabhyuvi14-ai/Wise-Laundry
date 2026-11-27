import * as staffService from '../services/staff.service.js'
import { saveBillSchema, advanceStatusSchema, validate } from '../utils/validation.js'

export async function getOrder(req, res, next) {
  try {
    return res.json({ data: await staffService.getOrderForStaff(req.params.id) })
  } catch (err) {
    next(err)
  }
}

export async function saveBill(req, res, next) {
  try {
    const data = validate(saveBillSchema, req.body)
    return res.json({ data: await staffService.saveBill(req.user, req.params.id, data) })
  } catch (err) {
    next(err)
  }
}

export async function getWorkList(req, res, next) {
  try {
    return res.json({ data: await staffService.getWorkList({ day: req.query.day }) })
  } catch (err) {
    next(err)
  }
}

export async function advanceStatus(req, res, next) {
  try {
    const data = validate(advanceStatusSchema, req.body)
    return res.json({ data: await staffService.advanceStatus(req.user, req.params.id, data) })
  } catch (err) {
    next(err)
  }
}
