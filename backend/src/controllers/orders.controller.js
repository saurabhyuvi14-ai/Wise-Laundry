import * as bookingService from '../services/booking.service.js'
import * as trackingService from '../services/tracking.service.js'
import { createOrderSchema, listOrdersQuerySchema, cancelOrderSchema, rescheduleOrderSchema, feedbackSchema, expressSwitchSchema, validate } from '../utils/validation.js'

export async function createOrder(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey
    const data = validate(createOrderSchema, req.body)

    const order = await bookingService.createOrder(req.user._id, data, idempotencyKey)
    return res.status(201).json({ data: order })
  } catch (err) {
    next(err)
  }
}

export async function listOrders(req, res, next) {
  try {
    const query = validate(listOrdersQuerySchema, req.query)
    const { orders, meta } = await bookingService.listOrders(req.user._id, query)
    return res.json({ data: orders, meta })
  } catch (err) {
    next(err)
  }
}

export async function getOrder(req, res, next) {
  try {
    const order = await bookingService.getOrderById(req.user._id, req.params.id)
    return res.json({ data: order })
  } catch (err) {
    next(err)
  }
}

export async function getTracking(req, res, next) {
  try {
    const tracking = await trackingService.getTracking(req.user._id, req.params.id)
    return res.json({ data: tracking })
  } catch (err) {
    next(err)
  }
}

export async function advanceOrder(req, res, next) {
  try {
    const order = await trackingService.advanceOrder(req.user._id, req.params.id)
    return res.json({ data: order })
  } catch (err) {
    next(err)
  }
}


export async function cancelOrder(req, res, next) {
  try {
    const data = validate(cancelOrderSchema, req.body)
    const order = await bookingService.cancelOrder(req.user._id, req.params.id, data)
    return res.json({ data: order })
  } catch (err) {
    next(err)
  }
}

export async function rescheduleOrder(req, res, next) {
  try {
    const data = validate(rescheduleOrderSchema, req.body)
    const order = await bookingService.rescheduleOrder(req.user._id, req.params.id, data)
    return res.json({ data: order })
  } catch (err) {
    next(err)
  }
}

export async function submitFeedback(req, res, next) {
  try {
    const data = validate(feedbackSchema, req.body)
    const order = await bookingService.submitFeedback(req.user._id, req.params.id, data)
    return res.json({ data: order })
  } catch (err) {
    next(err)
  }
}

export async function setExpress(req, res, next) {
  try {
    const data = validate(expressSwitchSchema, req.body)
    const order = await bookingService.setExpress(req.user._id, req.params.id, data)
    return res.json({ data: order })
  } catch (err) {
    next(err)
  }
}
