import { Order } from '../models/Order.js'
import { User } from '../models/User.js'

const WINDOW_DAYS = 30
const MAX_ITEMS = 40

/**
 * The customer's updates feed, built from their orders' status history
 * (no separate store to keep in sync). Newer than notificationsSeenAt = unread.
 */
export async function listNotifications(user) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const orders = await Order.find({ userId: user._id, updatedAt: { $gte: since } })
    .select('orderIdString reference items statusHistory scheduleHistory')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean()

  const seenAt = user.notificationsSeenAt ? new Date(user.notificationsSeenAt) : null
  const items = []
  for (const o of orders) {
    const base = { orderId: o.orderIdString || o._id.toString(), reference: o.reference, serviceName: o.items?.[0]?.serviceName || '' }
    for (const h of o.statusHistory || []) {
      if (!h.changedAt || h.changedAt < since) continue
      items.push({ ...base, id: `${base.orderId}:${h.status}:${h.changedAt.getTime()}`, kind: 'STATUS', status: h.status, note: h.note || '', at: h.changedAt })
    }
    for (const r of o.scheduleHistory || []) {
      if (!r.changedAt || r.changedAt < since) continue
      items.push({ ...base, id: `${base.orderId}:RESCHEDULED:${r.changedAt.getTime()}`, kind: 'RESCHEDULED', status: 'BOOKED', to: r.to?.toISOString?.() ?? null, at: r.changedAt })
    }
  }

  items.sort((a, b) => b.at - a.at)
  const list = items.slice(0, MAX_ITEMS).map((n) => ({ ...n, at: n.at.toISOString(), unread: !seenAt || n.at > seenAt }))
  return {
    items: list,
    unreadCount: list.filter((n) => n.unread).length,
    seenAt: seenAt ? seenAt.toISOString() : null,
  }
}

export async function markSeen(userId) {
  const now = new Date()
  await User.updateOne({ _id: userId }, { $set: { notificationsSeenAt: now } })
  return { seenAt: now.toISOString() }
}
