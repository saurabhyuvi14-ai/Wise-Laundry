import webpush from 'web-push'
import { config } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ApiError } from '../utils/errors.js'
import { PushSubscription } from '../models/PushSubscription.js'

let ready = false
export function pushEnabled() {
  if (ready) return true
  if (!config?.VAPID_PUBLIC_KEY || !config?.VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY)
  ready = true
  return true
}

export const publicKey = () => (pushEnabled() ? config.VAPID_PUBLIC_KEY : null)

/** Save (or refresh) a device's subscription for this user. */
export async function saveSubscription(userId, sub, userAgent = '') {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw ApiError.badRequest('Invalid push subscription.')
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    { userId, endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, userAgent },
    { upsert: true, new: true },
  )
}

export async function removeSubscription(endpoint) {
  if (endpoint) await PushSubscription.deleteOne({ endpoint })
}

/** Send a push to every device a user has. Dead subscriptions are cleaned up automatically. */
export async function notifyUser(userId, payload) {
  if (!pushEnabled()) return
  const subs = await PushSubscription.find({ userId })
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload))
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id })
        else logger.warn({ err: err.message }, 'push send failed')
      }
    }),
  )
}

const STATUS_MESSAGE = {
  PICKED_UP: 'Picked up — on its way to our laundry.',
  RECEIVED: 'Your clothes reached our laundry.',
  WASHING: 'Your laundry is being washed.',
  IRONING: 'Your clothes are being ironed.',
  READY_FOR_DELIVERY: 'Your laundry is ready.',
  OUT_FOR_DELIVERY: 'Out for delivery — on the way to you.',
  DELIVERED: 'Delivered. Thank you!',
  CANCELLED: 'Your pickup was cancelled.',
}

/** Push an order's new status to its customer. Fire-and-forget; never blocks the request. */
export function notifyOrderStatus(order) {
  const body = STATUS_MESSAGE[order.currentStatus]
  if (!body) return
  notifyUser(order.userId, {
    title: `Wise Laundry · ${order.reference}`,
    body,
    url: `/customer/orders/${order.orderIdString || order._id}/tracking`,
    tag: `order-${order.reference}`,
  }).catch(() => {})
}
