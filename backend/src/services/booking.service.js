import { Order } from '../models/Order.js'
import { Address } from '../models/Address.js'
import { Service } from '../models/Service.js'
import { reserveSlot, releaseSlot } from './slot.service.js'
import { assertServiceArea } from './location.service.js'
import { enforceOwnership } from '../middleware/auth.js'
import { ApiError } from '../utils/errors.js'

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

