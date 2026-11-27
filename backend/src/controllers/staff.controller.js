import * as staffService from '../services/staff.service.js'
import * as paymentService from '../services/payment.service.js'
import { saveBillSchema, advanceStatusSchema, assignRiderSchema, setRoleSchema, setPaymentSchema, validate } from '../utils/validation.js'

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
    return res.json({ data: await staffService.getWorkList(req.user, { day: req.query.day }) })
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

export async function listRiders(req, res, next) {
  try {
    return res.json({ data: await staffService.listRiders() })
  } catch (err) {
    next(err)
  }
}

export async function assignRider(req, res, next) {
  try {
    const data = validate(assignRiderSchema, req.body)
    return res.json({ data: await staffService.assignRider(req.params.id, data) })
  } catch (err) {
    next(err)
  }
}

export async function listTeam(req, res, next) {
  try {
    return res.json({ data: await staffService.listTeam() })
  } catch (err) {
    next(err)
  }
}

export async function setRole(req, res, next) {
  try {
    const data = validate(setRoleSchema, req.body)
    return res.json({ data: await staffService.setRole(req.user, data) })
  } catch (err) {
    next(err)
  }
}

export async function setPayment(req, res, next) {
  try {
    const data = validate(setPaymentSchema, req.body)
    return res.json({ data: await paymentService.setPayment(req.user, req.params.id, data) })
  } catch (err) {
    next(err)
  }
}
