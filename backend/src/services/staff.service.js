import { Order } from '../models/Order.js'
import { Service } from '../models/Service.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/errors.js'
import { findOrderByIdOrRef } from './booking.service.js'
import { BILLABLE_STATUSES, computeBill, orderExpress, orderTurnaroundHours, validateQuantity } from './billing.service.js'

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
  const bill = computeBill(item, q, { express: orderExpress(order) })
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
    order.estimatedDeliveryAt = new Date(now.getTime() + orderTurnaroundHours(order, service) * 3600000)
  }

  order.markModified('items')
  await order.save()
  return withCustomer(order)
}

// ---------- Work list ----------

const AT_LAUNDRY = ['PICKED_UP', 'RECEIVED', 'WASHING', 'IRONING', 'READY_FOR_DELIVERY']
const IST = '+05:30'

/** Start and end of a calendar day in India time. `day` is YYYY-MM-DD; defaults to today. */
export function istDayRange(day) {
  const key = day || new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)
  const start = new Date(`${key}T00:00:00${IST}`)
  if (Number.isNaN(start.getTime())) throw ApiError.badRequest('Pick a valid date.', { day: 'Use YYYY-MM-DD.' })
  return { key, start, end: new Date(start.getTime() + 24 * 3600000) }
}

function workCard(order, customer) {
  const o = order.toJSON()
  const a = o.addressSnapshot || {}
  return {
    id: o.id,
    reference: o.reference,
    status: o.currentStatus,
    serviceName: o.items?.[0]?.serviceName,
    pricingUnit: o.items?.[0]?.pricingUnit,
    quantity: o.items?.[0]?.quantity ?? null,
    express: o.express,
    pickupScheduledAt: o.pickupScheduledAt,
    pickupSlotHours: o.pickupSlotHours,
    estimatedDeliveryAt: o.estimatedDeliveryAt || null,
    instructions: o.instructions || '',
    billed: Boolean(o.bill),
    customer: {
      fullName: customer?.fullName || a.recipientName || 'Customer',
      phone: a.phone || customer?.phone || '',
    },
    address: {
      line1: a.addressLine1,
      line2: a.addressLine2,
      landmark: a.landmark,
      city: a.city,
      postalCode: a.postalCode,
      coordinates: a.coordinates || null,
    },
  }
}

/**
 * Everything staff need for one day, in three groups:
 * - toPickup: booked pickups for that day (plus any earlier ones nobody collected yet, when looking at today)
 * - atLaundry: collected and not yet sent out (any day), express first
 * - toDeliver: out for delivery right now
 */
export async function getWorkList({ day } = {}) {
  const { key, start, end } = istDayRange(day)
  const today = istDayRange().key
  const pickupWhen = key === today ? { $lt: end } : { $gte: start, $lt: end }

  const [pickups, laundry, deliveries] = await Promise.all([
    Order.find({ currentStatus: 'BOOKED', pickupScheduledAt: pickupWhen }).sort({ pickupScheduledAt: 1 }).limit(200),
    Order.find({ currentStatus: { $in: AT_LAUNDRY } }).sort({ estimatedDeliveryAt: 1, pickupScheduledAt: 1 }).limit(200),
    Order.find({ currentStatus: 'OUT_FOR_DELIVERY' }).sort({ updatedAt: 1 }).limit(200),
  ])

  const userIds = [...new Set([...pickups, ...laundry, ...deliveries].map((o) => String(o.userId)))]
  const users = await User.find({ _id: { $in: userIds } }).select('fullName phone')
  const byId = new Map(users.map((u) => [String(u._id), u]))
  const card = (o) => workCard(o, byId.get(String(o.userId)))

  const expressFirst = (a, b) => Number(Boolean(b.express)) - Number(Boolean(a.express))
  const toPickup = pickups.map(card).map((c) => ({ ...c, late: new Date(c.pickupScheduledAt) < start }))
  const atLaundry = laundry.map(card).sort(expressFirst)

  return {
    day: key,
    groups: { toPickup, atLaundry, toDeliver: deliveries.map(card) },
  }
}
