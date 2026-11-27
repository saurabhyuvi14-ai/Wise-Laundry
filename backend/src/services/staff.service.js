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

function workCard(order, customer, service, rider) {
  const o = order.toJSON()
  const a = o.addressSnapshot || {}
  return {
    id: o.id,
    reference: o.reference,
    status: o.currentStatus,
    nextStatus: nextStage(order, service),
    serviceName: o.items?.[0]?.serviceName,
    pricingUnit: o.items?.[0]?.pricingUnit,
    quantity: o.items?.[0]?.quantity ?? null,
    express: o.express,
    pickupScheduledAt: o.pickupScheduledAt,
    pickupSlotHours: o.pickupSlotHours,
    estimatedDeliveryAt: o.estimatedDeliveryAt || null,
    instructions: o.instructions || '',
    billed: Boolean(o.bill),
    rider: rider ? { id: String(rider._id), fullName: rider.fullName } : null,
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
export async function getWorkList(user, { day } = {}) {
  const { key, start, end } = istDayRange(day)
  const today = istDayRange().key
  const pickupWhen = key === today ? { $lt: end } : { $gte: start, $lt: end }
  // Riders only see the jobs given to them.
  const mine = user.role === 'RIDER' ? { riderId: user._id } : {}

  const [pickups, laundry, deliveries] = await Promise.all([
    Order.find({ ...mine, currentStatus: 'BOOKED', pickupScheduledAt: pickupWhen }).sort({ pickupScheduledAt: 1 }).limit(200),
    Order.find({ ...mine, currentStatus: { $in: AT_LAUNDRY } }).sort({ estimatedDeliveryAt: 1, pickupScheduledAt: 1 }).limit(200),
    Order.find({ ...mine, currentStatus: 'OUT_FOR_DELIVERY' }).sort({ updatedAt: 1 }).limit(200),
  ])

  const all = [...pickups, ...laundry, ...deliveries]
  const peopleIds = [...new Set(all.flatMap((o) => [String(o.userId), o.riderId && String(o.riderId)]).filter(Boolean))]
  const [people, services] = await Promise.all([User.find({ _id: { $in: peopleIds } }).select('fullName phone'), Service.find()])
  const byId = new Map(people.map((u) => [String(u._id), u]))
  const serviceById = new Map(services.map((s) => [s.serviceId, s]))
  const card = (o) => workCard(o, byId.get(String(o.userId)), serviceById.get(o.items[0]?.serviceId), o.riderId && byId.get(String(o.riderId)))

  const expressFirst = (a, b) => Number(Boolean(b.express)) - Number(Boolean(a.express))
  const toPickup = pickups.map(card).map((c) => ({ ...c, late: new Date(c.pickupScheduledAt) < start }))
  const atLaundry = laundry.map(card).sort(expressFirst)

  return {
    day: key,
    groups: { toPickup, atLaundry, toDeliver: deliveries.map(card) },
  }
}

// ---------- Status buttons ----------

// Steps a rider can mark; the washing steps are for laundry staff.
const RIDER_STEPS = ['PICKED_UP', 'RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED']

/** The status after the order's current one, following its service's steps; null at the end. */
function nextStage(order, service) {
  const stages = service?.stages || []
  const i = stages.indexOf(order.currentStatus)
  return i >= 0 && i < stages.length - 1 ? stages[i + 1] : null
}

/**
 * Move an order one step forward (Picked up → At laundry → Washing → Out for delivery → Delivered).
 * `from` is the status the staff member saw, so a double tap or two staff tapping at once can't skip a step.
 */
export async function advanceStatus(staffUser, idOrRef, { from }) {
  const order = await loadOrder(idOrRef)
  if (staffUser.role === 'RIDER' && String(order.riderId) !== String(staffUser._id)) {
    throw ApiError.forbidden('This job is not assigned to you.')
  }
  if (order.currentStatus !== from) {
    throw new ApiError(409, 'ORDER_CHANGED', 'Someone already updated this order. Refresh to see the latest.')
  }
  const service = await Service.findOne({ serviceId: order.items[0]?.serviceId })
  const next = nextStage(order, service)
  if (!next || order.currentStatus === 'CANCELLED') {
    throw new ApiError(409, 'ORDER_FINISHED', 'This order has no next step.')
  }
  if (staffUser.role === 'RIDER' && !RIDER_STEPS.includes(next)) {
    throw ApiError.forbidden('Only laundry staff can do this step.')
  }
  if (next === 'OUT_FOR_DELIVERY' && !order.bill?.finalizedAt) {
    throw new ApiError(409, 'NOT_BILLED', 'Weigh and bill this order before sending it out.')
  }

  const now = new Date()
  const set = { currentStatus: next }
  // Clock starts when clothes reach the laundry (if billing didn't already start it).
  if (next === 'RECEIVED' && !order.estimatedDeliveryAt) {
    set.estimatedDeliveryAt = new Date(now.getTime() + orderTurnaroundHours(order, service) * 3600000)
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, currentStatus: from },
    { $set: set, $push: { statusHistory: { status: next, changedAt: now, note: `Updated by ${staffUser.fullName}.` } } },
    { new: true },
  )
  if (!updated) throw new ApiError(409, 'ORDER_CHANGED', 'Someone already updated this order. Refresh to see the latest.')
  return updated.toJSON()
}

// ---------- Riders and team ----------

export async function listRiders() {
  const riders = await User.find({ role: 'RIDER' }).select('fullName phone').sort({ fullName: 1 })
  return riders.map((r) => ({ id: String(r._id), fullName: r.fullName, phone: r.phone || '' }))
}

/** Give an order to a rider, or take it back (riderId null). */
export async function assignRider(idOrRef, { riderId }) {
  const order = await loadOrder(idOrRef)
  if (riderId) {
    const rider = await User.findOne({ _id: riderId, role: 'RIDER' })
    if (!rider) throw ApiError.badRequest('That person is not a rider.', { riderId: 'Pick a rider.' })
  }
  order.riderId = riderId || null
  await order.save()
  return order.toJSON()
}

const TEAM_ROLES = ['RIDER', 'STAFF', 'ADMIN']

export async function listTeam() {
  const team = await User.find({ role: { $in: TEAM_ROLES } }).select('fullName email phone role').sort({ role: 1, fullName: 1 })
  return team.map((u) => ({ id: String(u._id), fullName: u.fullName, email: u.email, phone: u.phone || '', role: u.role }))
}

/** Admin gives someone a team role by email, or sets them back to CUSTOMER to remove them. */
export async function setRole(admin, { email, role }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
  if (!user) throw ApiError.badRequest('No account with that email. Ask them to sign up first.', { email: 'Not found.' })
  if (String(user._id) === String(admin._id)) throw ApiError.badRequest("You can't change your own role.", { email: 'This is you.' })
  user.role = role
  await user.save()
  // A rider who is removed shouldn't keep jobs.
  if (role !== 'RIDER') await Order.updateMany({ riderId: user._id }, { $set: { riderId: null } })
  return { id: String(user._id), fullName: user.fullName, email: user.email, phone: user.phone || '', role: user.role }
}
