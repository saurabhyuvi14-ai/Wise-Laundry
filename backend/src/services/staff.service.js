import { Order } from '../models/Order.js'
import { Service } from '../models/Service.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/errors.js'
import { findOrderByIdOrRef } from './booking.service.js'
import { BILLABLE_STATUSES, computeBill, validateQuantity } from './billing.service.js'

async function loadOrder(idOrRef) {
  const order = await findOrderByIdOrRef(String(idOrRef || '').trim().toUpperCase().startsWith('WL-') ? String(idOrRef).trim().toUpperCase() : idOrRef)
  if (!order) throw ApiError.notFound('No order with that number.')
  return order
}

async function withCustomer(order) {
  const customer = await User.findById(order.userId).select('fullName phone email')
  return {
    ...order.toJSON(),
    customer: customer ? { fullName: customer.fullName, phone: customer.phone, email: customer.email } : null,
    canBill: BILLABLE_STATUSES.includes(order.currentStatus),
  }
}

/** Staff look-up by order number (WL-1001) or id. */
export async function getOrderForStaff(idOrRef) {
  return withCustomer(await loadOrder(idOrRef))
}

/**
 * Staff enter the weight / count after pickup. Works out and saves the final bill.
 * The first bill on a PICKED_UP order also moves it to RECEIVED ("At laundry").
 * The bill can be corrected until the order goes out for delivery.
 */
export async function saveBill(staffUser, idOrRef, { quantity, note }) {
  const order = await loadOrder(idOrRef)
  if (!BILLABLE_STATUSES.includes(order.currentStatus)) {
    const why = order.currentStatus === 'BOOKED'
      ? 'This order has not been picked up yet.'
      : 'This order can no longer be billed (it is out for delivery, delivered or cancelled).'
    throw new ApiError(409, 'ORDER_NOT_BILLABLE', why)
  }

  const item = order.items[0]
  const q = validateQuantity(item.pricingUnit, quantity)
  const bill = computeBill(item, q)
  const now = new Date()

  item.quantity = q
  order.bill = {
    ...bill,
    finalizedAt: now,
    finalizedBy: staffUser?.email || 'staff',
    revision: (order.bill?.revision || 0) + 1,
  }

  if (order.currentStatus === 'PICKED_UP') {
    order.currentStatus = 'RECEIVED'
    const unit = item.pricingUnit === 'PIECE' ? `${q} items counted` : `Weighed at ${q} kg`
    order.statusHistory.push({ status: 'RECEIVED', changedAt: now, note: `${unit}. Final bill ready.${note ? ` ${note}` : ''}` })
  }

  if (!order.estimatedDeliveryAt) {
    const service = await Service.findOne({ serviceId: item.serviceId })
    order.estimatedDeliveryAt = new Date(now.getTime() + (service?.turnaroundHours || 48) * 3600000)
  }

  order.markModified('items')
  await order.save()
  return withCustomer(order)
}
