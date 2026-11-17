import { Service } from '../models/Service.js'
import { findOrderByIdOrRef } from './booking.service.js'
import { enforceOwnership } from '../middleware/auth.js'
import { ApiError } from '../utils/errors.js'
import { config } from '../config/env.js'

export async function getTracking(userId, idOrRef) {
  const order = await findOrderByIdOrRef(idOrRef)
  if (!order) {
    throw ApiError.notFound('Order not found.')
  }

  enforceOwnership(order.userId, userId)
  const json = order.toJSON()

  return {
    orderId: json.id,
    reference: json.reference,
    serviceId: json.items[0]?.serviceId,
    currentStatus: json.currentStatus,
    estimatedDeliveryAt: json.estimatedDeliveryAt,
    updatedAt: json.updatedAt,
    history: json.statusHistory,
  }
}

export async function advanceOrder(userId, idOrRef) {
  // Restriction: simulation only in development and test environments
  if (config?.NODE_ENV === 'production') {
    throw ApiError.forbidden('Order advance simulation is disabled in production.')
  }

  const order = await findOrderByIdOrRef(idOrRef)
  if (!order) {
    throw ApiError.notFound('Order not found.')
  }

  enforceOwnership(order.userId, userId)

  const service = await Service.findOne({ serviceId: order.items[0]?.serviceId })
  const stages = service?.stages || [
    'BOOKED',
    'PICKED_UP',
    'RECEIVED',
    'WASHING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ]
  const currentIndex = stages.indexOf(order.currentStatus)

  if (currentIndex >= 0 && currentIndex < stages.length - 1) {
    const nextStage = stages[currentIndex + 1]
    order.currentStatus = nextStage
    const historyItem = {
      status: nextStage,
      changedAt: new Date(),
      note: `Status updated to ${nextStage}.`,
    }

    if (nextStage === 'RECEIVED' && order.items[0]?.quantity == null) {
      const isPiece = order.items[0]?.pricingUnit === 'PIECE'
      order.items[0].quantity = isPiece ? 6 : 3.5
      historyItem.note = isPiece
        ? '6 items counted. Final price confirmed.'
        : 'Weighed at 3.5 kg. Final price confirmed.'
      order.estimatedDeliveryAt = new Date(
        Date.now() + (service?.turnaroundHours || 48) * 3600000,
      )
    }

    order.statusHistory.push(historyItem)
    await order.save()
  }

  return order.toJSON()
}

