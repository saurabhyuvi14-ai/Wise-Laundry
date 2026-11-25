import { Order } from '../models/Order.js'
import { Address } from '../models/Address.js'
import { Service } from '../models/Service.js'
import { reserveSlot, releaseSlot } from './slot.service.js'
import { assertServiceArea } from './location.service.js'
import { enforceOwnership } from '../middleware/auth.js'
import { ApiError } from '../utils/errors.js'
import { changeDeadline, getChangeRules, policySettings } from './orderPolicy.js'

export const ACTIVE_STATUSES = [
  'BOOKED',
  'PICKED_UP',
  'RECEIVED',
  'WASHING',
  'IRONING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
]

export async function createOrder(userId, data, idempotencyKey) {
  let reservedSlot = false
  let dateStr = ''
  let slotHour = 0

  try {
    if (idempotencyKey) {
      const existing = await Order.findOne({ userId, idempotencyKey })
      if (existing) {
        return existing.toJSON()
      }
    }

    // 1. Validate service
    const requestedItem = data.items[0]
    const service = await Service.findOne({
      $or: [{ serviceId: requestedItem.serviceId }, { code: requestedItem.serviceId }],
      active: true,
    })
    if (!service) {
      throw ApiError.badRequest('The requested service is not available.', {
        'items.0.serviceId': 'Choose a valid active service.',
      })
    }

    // 2. Validate address, ownership, and service-area availability
    const address = await Address.findById(data.addressId)
    if (!address) {
      throw ApiError.badRequest('Pickup address not found.', {
        addressId: 'Choose a valid pickup address.',
      })
    }
    enforceOwnership(address.userId, userId)

    const addressSnapshot = address.getDecryptedSnapshot()
    assertServiceArea({
      coordinates: addressSnapshot.coordinates,
      city: addressSnapshot.city,
      postalCode: addressSnapshot.postalCode,
    })

    // 3. Atomically validate and reserve pickup slot capacity
    const pickupDate = new Date(data.pickupScheduledAt)
    dateStr = pickupDate.toISOString().split('T')[0]
    slotHour = pickupDate.getUTCHours()
    await reserveSlot(dateStr, slotHour)
    reservedSlot = true

    // 4. Generate next reference number (WL-1001, WL-1002, ...)
    const orderCount = await Order.countDocuments()
    const nextRefNum = 1001 + orderCount
    const reference = `WL-${nextRefNum}`
    const orderIdString = `order_${nextRefNum}`

    // 5. Build order with encrypted sensitive address snapshot and initial status history
    const order = new Order({
      orderIdString,
      reference,
      userId,
      items: [
        {
          serviceId: service.serviceId,
          serviceName: service.name,
          pricingUnit: service.pricingUnit,
          quantity: null, // confirmed by staff after collection
          unitPricePaise: service.unitPricePaise,
        },
      ],
      pickupScheduledAt: pickupDate,
      pickupSlotHours: data.pickupSlotHours || 2,
      idempotencyKey: idempotencyKey || undefined,
      currentStatus: 'BOOKED',
      statusHistory: [
        {
          status: 'BOOKED',
          changedAt: new Date(),
          note: 'Pickup requested by customer.',
        },
      ],
      currency: 'INR',
    })

    order.setEncryptedAddressSnapshot(addressSnapshot)
    order.setEncryptedInstructions(data.instructions)

    await order.save()
    return order.toJSON()
  } catch (err) {
    if (reservedSlot) {
      await releaseSlot(dateStr, slotHour).catch(() => {})
    }
    throw err
  }
}

export async function listOrders(userId, { status = 'all', page = 1, pageSize = 10 }) {
  const filter = { userId }
  if (status === 'active') {
    filter.currentStatus = { $in: ACTIVE_STATUSES }
  } else if (status === 'past') {
    filter.currentStatus = { $nin: ACTIVE_STATUSES }
  }

  const total = await Order.countDocuments(filter)
  const list = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)

  return {
    orders: list.map((o) => o.toJSON()),
    meta: { page, pageSize, total },
  }
}

export async function getOrderById(userId, idOrRef) {
  const order = await findOrderByIdOrRef(idOrRef)
  if (!order) {
    throw ApiError.notFound('Order not found.')
  }

  enforceOwnership(order.userId, userId)
  return order.toJSON()
}

export async function findOrderByIdOrRef(idOrRef) {
  if (!idOrRef) return null
  if (idOrRef.startsWith('order_')) {
    return Order.findOne({ orderIdString: idOrRef })
  }
  if (idOrRef.startsWith('WL-')) {
    return Order.findOne({ reference: idOrRef })
  }
  return Order.findOne({
    $or: [
      { _id: idOrRef.match(/^[0-9a-fA-F]{24}$/) ? idOrRef : null },
      { orderIdString: idOrRef },
      { reference: idOrRef },
    ],
  })
}


const slotOf = (date) => ({ dateStr: date.toISOString().split('T')[0], slotHour: date.getUTCHours() })

function explainBlocked(order, action) {
  const rules = getChangeRules(order)
  if (order.currentStatus === 'CANCELLED') {
    return new ApiError(409, 'ORDER_ALREADY_CANCELLED', 'This order is already cancelled.')
  }
  if (rules.blockedReason === 'NOT_BOOKED') {
    return new ApiError(409, 'ORDER_ALREADY_PICKED_UP', 'Your clothes have already been picked up, so this order can no longer be changed here. Please contact us.')
  }
  if (rules.blockedReason === 'TOO_LATE') {
    const { cutoffMinutes } = policySettings()
    return new ApiError(409, 'ORDER_CHANGE_TOO_LATE', `Changes close ${cutoffMinutes / 60} hours before pickup. Please contact us to ${action} this order.`)
  }
  if (action === 'reschedule' && !rules.canReschedule) {
    return new ApiError(409, 'RESCHEDULE_LIMIT_REACHED', 'This order has already been rescheduled the maximum number of times. You can cancel it and book again.')
  }
  return new ApiError(409, 'ORDER_CHANGED', 'This order was just changed. Please refresh and try again.')
}

async function loadOwnOrder(userId, idOrRef) {
  const order = await findOrderByIdOrRef(idOrRef)
  if (!order) throw ApiError.notFound('Order not found.')
  enforceOwnership(order.userId, userId)
  return order
}

/**
 * Cancel a pickup. Allowed only while the order is BOOKED and before the change deadline.
 * The update itself re-checks those conditions, so a double click or a stale page can't slip through.
 */
export async function cancelOrder(userId, idOrRef, { reason, note }) {
  const order = await loadOwnOrder(userId, idOrRef)
  const now = new Date()

  // Pressing cancel twice is fine: the second time just returns the cancelled order.
  if (order.currentStatus === 'CANCELLED' && order.cancellation?.cancelledBy === 'CUSTOMER') {
    return order.toJSON()
  }

  const { cutoffMinutes } = policySettings()
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      currentStatus: 'BOOKED',
      pickupScheduledAt: { $gt: new Date(now.getTime() + cutoffMinutes * 60 * 1000) },
    },
    {
      $set: {
        currentStatus: 'CANCELLED',
        cancellation: { reason, note: note || '', cancelledAt: now, cancelledBy: 'CUSTOMER' },
      },
      $push: { statusHistory: { status: 'CANCELLED', changedAt: now, note: 'Cancelled by customer.' } },
    },
    { new: true },
  )

  if (!updated) throw explainBlocked(await Order.findById(order._id), 'cancel')

  const { dateStr, slotHour } = slotOf(order.pickupScheduledAt)
  await releaseSlot(dateStr, slotHour).catch(() => {})
  return updated.toJSON()
}

/**
 * Move a pickup to a new slot. Same deadline as cancelling, limited number of times,
 * new slot must have room and be at least the cutoff away from now.
 */
export async function rescheduleOrder(userId, idOrRef, { pickupScheduledAt, pickupSlotHours }) {
  const order = await loadOwnOrder(userId, idOrRef)
  const rules = getChangeRules(order)
  if (!rules.canCancel || !rules.canReschedule) throw explainBlocked(order, 'reschedule')

  const now = new Date()
  const newTime = new Date(pickupScheduledAt)
  const { cutoffMinutes, maxReschedules, rescheduleMaxDays } = policySettings()

  if (newTime.getTime() === order.pickupScheduledAt.getTime()) {
    throw ApiError.badRequest('That is already your pickup time. Pick a different slot.', { pickupScheduledAt: 'Pick a different slot.' })
  }
  if (changeDeadline(newTime) <= now) {
    throw ApiError.badRequest(`Pick a slot at least ${cutoffMinutes / 60} hours from now.`, { pickupScheduledAt: 'This slot is too soon.' })
  }
  if (newTime.getTime() > now.getTime() + rescheduleMaxDays * 24 * 60 * 60 * 1000) {
    throw ApiError.badRequest(`Pick a slot within the next ${rescheduleMaxDays} days.`, { pickupScheduledAt: 'This slot is too far ahead.' })
  }

  // Hold the new slot first; give it back if anything below fails.
  const next = slotOf(newTime)
  await reserveSlot(next.dateStr, next.slotHour)

  const oldTime = order.pickupScheduledAt
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      currentStatus: 'BOOKED',
      // Same time as when we read it (nobody changed it meanwhile) and still before the deadline.
      pickupScheduledAt: { $eq: oldTime, $gt: new Date(now.getTime() + cutoffMinutes * 60 * 1000) },
      rescheduleCount: { $lt: maxReschedules },
    },
    {
      $set: { pickupScheduledAt: newTime, ...(pickupSlotHours ? { pickupSlotHours } : {}) },
      $inc: { rescheduleCount: 1 },
      $push: { scheduleHistory: { from: oldTime, to: newTime, changedAt: now, changedBy: 'CUSTOMER' } },
    },
    { new: true },
  )

  if (!updated) {
    await releaseSlot(next.dateStr, next.slotHour).catch(() => {})
    throw explainBlocked(await Order.findById(order._id), 'reschedule')
  }

  const prev = slotOf(oldTime)
  await releaseSlot(prev.dateStr, prev.slotHour).catch(() => {})
  return updated.toJSON()
}
