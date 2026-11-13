import { Router } from 'express'
import { Order } from '../models/Order.js'
import { Address } from '../models/Address.js'
import { Service } from '../models/Service.js'
import { SlotCapacity } from '../models/SlotCapacity.js'
import { createOrderSchema, listOrdersQuerySchema, validate } from '../utils/validation.js'
import { requireAuth, enforceOwnership } from '../middleware/auth.js'
import { privateCacheControl } from '../middleware/cacheControl.js'
import { ApiError } from '../utils/errors.js'

const router = Router()

router.use(requireAuth)
router.use(privateCacheControl)

const ACTIVE_STATUSES = ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY']

// POST /api/v1/orders
router.post('/', async (req, res, next) => {
  let reservedSlot = false
  let dateStr = ''
  let slotHour = 0

  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey
    if (idempotencyKey) {
      const existing = await Order.findOne({ userId: req.user._id, idempotencyKey })
      if (existing) {
        return res.status(200).json({ data: existing.toJSON() })
      }
    }

    const data = validate(createOrderSchema, req.body)

    // 1. Validate service
    const requestedItem = data.items[0]
    const service = await Service.findOne({ serviceId: requestedItem.serviceId, active: true })
    if (!service) {
      throw ApiError.badRequest('The requested service is not available.', {
        'items.0.serviceId': 'Choose a valid active service.',
      })
    }

    // 2. Validate address and ownership
    const address = await Address.findById(data.addressId)
    if (!address) {
      throw ApiError.badRequest('Pickup address not found.', {
        addressId: 'Choose a valid pickup address.',
      })
    }
    enforceOwnership(address.userId, req.user._id)

    // 3. Atomically validate and reserve pickup slot capacity
    const pickupDate = new Date(data.pickupScheduledAt)
    dateStr = pickupDate.toISOString().split('T')[0]
    slotHour = pickupDate.getUTCHours() // or slot based on requested window
    await SlotCapacity.reserveSlot(dateStr, slotHour)
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
      userId: req.user._id,
      items: [
        {
          serviceId: service.serviceId,
          serviceName: service.name,
          pricingUnit: service.pricingUnit,
          quantity: null, // confirmed by staff after pickup
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

    // Managed field encryption for snapshot
    order.setEncryptedAddressSnapshot({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.getDecryptedSnapshot().addressLine1,
      addressLine2: address.getDecryptedSnapshot().addressLine2,
      landmark: address.landmark,
      city: address.city,
      postalCode: address.postalCode,
      instructions: address.getDecryptedSnapshot().instructions,
    })

    order.setEncryptedInstructions(data.instructions)

    await order.save()
    return res.status(201).json({ data: order.toJSON() })
  } catch (err) {
    if (reservedSlot) {
      // Rollback slot reservation on creation failure
      await SlotCapacity.releaseSlot(dateStr, slotHour).catch(() => {})
    }
    next(err)
  }
})

// GET /api/v1/orders
router.get('/', async (req, res, next) => {
  try {
    const { status, page, pageSize } = validate(listOrdersQuerySchema, req.query)

    const filter = { userId: req.user._id }
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

    return res.json({
      data: list.map((o) => o.toJSON()),
      meta: { page, pageSize, total },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const order = await findOrderByIdOrRef(req.params.id)
    if (!order) {
      throw ApiError.notFound('Order not found.')
    }

    enforceOwnership(order.userId, req.user._id)
    return res.json({ data: order.toJSON() })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/orders/:id/tracking
router.get('/:id/tracking', async (req, res, next) => {
  try {
    const order = await findOrderByIdOrRef(req.params.id)
    if (!order) {
      throw ApiError.notFound('Order not found.')
    }

    enforceOwnership(order.userId, req.user._id)
    const json = order.toJSON()

    return res.json({
      data: {
        orderId: json.id,
        reference: json.reference,
        serviceId: json.items[0].serviceId,
        currentStatus: json.currentStatus,
        estimatedDeliveryAt: json.estimatedDeliveryAt,
        updatedAt: json.updatedAt,
        history: json.statusHistory,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/orders/:id/advance (for testing and simulation)
router.post('/:id/advance', async (req, res, next) => {
  try {
    const order = await findOrderByIdOrRef(req.params.id)
    if (!order) {
      throw ApiError.notFound('Order not found.')
    }

    enforceOwnership(order.userId, req.user._id)

    const service = await Service.findOne({ serviceId: order.items[0].serviceId })
    const stages = service?.stages || ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED']
    const currentIndex = stages.indexOf(order.currentStatus)

    if (currentIndex >= 0 && currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1]
      order.currentStatus = nextStage
      const historyItem = {
        status: nextStage,
        changedAt: new Date(),
        note: `Status updated to ${nextStage}.`,
      }

      if (nextStage === 'RECEIVED' && order.items[0].quantity == null) {
        const isPiece = order.items[0].pricingUnit === 'PIECE'
        order.items[0].quantity = isPiece ? 6 : 3.5
        historyItem.note = isPiece ? '6 items counted. Final price confirmed.' : 'Weighed at 3.5 kg. Final price confirmed.'
        order.estimatedDeliveryAt = new Date(Date.now() + (service?.turnaroundHours || 48) * 3600000)
      }

      order.statusHistory.push(historyItem)
      await order.save()
    }

    return res.json({ data: order.toJSON() })
  } catch (err) {
    next(err)
  }
})

async function findOrderByIdOrRef(idOrRef) {
  if (idOrRef.startsWith('order_')) {
    return Order.findOne({ orderIdString: idOrRef })
  }
  if (idOrRef.startsWith('WL-')) {
    return Order.findOne({ reference: idOrRef })
  }
  return Order.findOne({
    $or: [{ _id: idOrRef.match(/^[0-9a-fA-F]{24}$/) ? idOrRef : null }, { orderIdString: idOrRef }],
  })
}

export default router
