import { config } from '../config/env.js'

const MINUTE = 60 * 1000

export const CANCEL_REASONS = [
  'CHANGE_OF_PLANS',
  'NOT_AVAILABLE_AT_PICKUP',
  'BOOKED_BY_MISTAKE',
  'WANT_DIFFERENT_SERVICE',
  'OTHER',
]

export function policySettings() {
  return {
    cutoffMinutes: config?.ORDER_CHANGE_CUTOFF_MINUTES ?? 120,
    maxReschedules: config?.ORDER_MAX_RESCHEDULES ?? 2,
    rescheduleMaxDays: config?.ORDER_RESCHEDULE_MAX_DAYS ?? 7,
  }
}

/** Latest moment the customer can still change this pickup. */
export function changeDeadline(pickupScheduledAt) {
  return new Date(new Date(pickupScheduledAt).getTime() - policySettings().cutoffMinutes * MINUTE)
}

/**
 * What the customer may do with this order right now.
 * blockedReason: null | 'NOT_BOOKED' | 'TOO_LATE' | 'RESCHEDULE_LIMIT'
 */
export function getChangeRules(order, now = new Date()) {
  const { maxReschedules, cutoffMinutes } = policySettings()
  const deadline = order.pickupScheduledAt ? changeDeadline(order.pickupScheduledAt) : null
  const used = order.rescheduleCount || 0
  const reschedulesLeft = Math.max(0, maxReschedules - used)

  let blockedReason = null
  if (order.currentStatus !== 'BOOKED') blockedReason = 'NOT_BOOKED'
  else if (!deadline || now >= deadline) blockedReason = 'TOO_LATE'

  const canCancel = blockedReason === null
  const canReschedule = canCancel && reschedulesLeft > 0

  return {
    canCancel,
    canReschedule,
    changeDeadline: deadline ? deadline.toISOString() : null,
    reschedulesLeft,
    cutoffMinutes,
    blockedReason: blockedReason || (canReschedule ? null : 'RESCHEDULE_LIMIT'),
  }
}

// Express can be switched until the order heads out for delivery (and within the window).
const EXPRESS_SWITCH_STATUSES = ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'IRONING', 'READY_FOR_DELIVERY']

export function expressSwitchMinutes() {
  return config?.EXPRESS_SWITCH_WINDOW_MINUTES ?? 180
}

/**
 * Whether the customer can switch this order to express (or back) right now.
 * null when express wasn't offered for this order.
 */
export function getExpressRules(order, now = new Date()) {
  const e = order.express
  if (!e?.turnaroundHours) return null
  const created = order.createdAt ? new Date(order.createdAt) : now
  const deadline = new Date(created.getTime() + expressSwitchMinutes() * MINUTE)
  const open = now < deadline && EXPRESS_SWITCH_STATUSES.includes(order.currentStatus)
  return {
    canUpgrade: open && !e.enabled,
    canDowngrade: open && Boolean(e.enabled),
    deadline: deadline.toISOString(),
    surchargePercent: e.surchargePercent,
    turnaroundHours: e.turnaroundHours,
  }
}
