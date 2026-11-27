import { Order } from '../models/Order.js'
import { ApiError } from '../utils/errors.js'
import { findOrderByIdOrRef } from './booking.service.js'
import { enforceOwnership } from '../middleware/auth.js'
import { cashAllowed } from './billing.service.js'

async function loadOwn(userId, idOrRef) {
  const order = await findOrderByIdOrRef(idOrRef)
  if (!order) throw ApiError.notFound('Order not found.')
  enforceOwnership(order.userId, userId)
  return order
}

/** Customer taps "I've paid" after paying by UPI. Marks it pending until a person confirms the money arrived. */
export async function markPaidByCustomer(userId, idOrRef, { upiRef }) {
  const order = await loadOwn(userId, idOrRef)
  if (!order.bill?.finalizedAt) throw new ApiError(409, 'NO_BILL', 'Your bill is not ready yet.')
  if (order.payment?.status === 'PAID') return order.toJSON()
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, 'payment.status': { $ne: 'PAID' } },
    { $set: { 'payment.status': 'PENDING', 'payment.method': 'UPI', 'payment.upiRef': upiRef || '', 'payment.markedAt': new Date() } },
    { new: true },
  )
  return (updated || order).toJSON()
}

/**
 * Rider or staff record how the order was paid (they saw the UPI success screen or took cash),
 * or undo a wrong claim. Riders can only touch their own jobs.
 */
export async function setPayment(staffUser, idOrRef, { status, method }) {
  const order = await findOrderByIdOrRef(idOrRef)
  if (!order) throw ApiError.notFound('Order not found.')
  if (staffUser.role === 'RIDER' && String(order.riderId) !== String(staffUser._id)) {
    throw ApiError.forbidden('This job is not assigned to you.')
  }
  if (status === 'PAID') {
    if (!order.bill?.finalizedAt) throw new ApiError(409, 'NO_BILL', 'Weigh and bill this order before marking it paid.')
    if (method === 'CASH' && !cashAllowed()) throw ApiError.badRequest('Cash payments are turned off.', { method: 'Not allowed.' })
    order.payment = { status: 'PAID', method, upiRef: order.payment?.upiRef || '', markedAt: order.payment?.markedAt || new Date(), confirmedBy: staffUser.fullName, confirmedAt: new Date() }
  } else {
    order.payment = { status: 'UNPAID', method: null, upiRef: '', markedAt: null, confirmedBy: null, confirmedAt: null }
  }
  await order.save()
  return order.toJSON()
}
