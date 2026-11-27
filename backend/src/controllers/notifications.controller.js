import * as notificationService from '../services/notification.service.js'

export async function listNotifications(req, res, next) {
  try {
    const data = await notificationService.listNotifications(req.user)
    return res.json({ data: data.items, meta: { unreadCount: data.unreadCount, seenAt: data.seenAt } })
  } catch (err) {
    next(err)
  }
}

export async function markSeen(req, res, next) {
  try {
    return res.json({ data: await notificationService.markSeen(req.user._id) })
  } catch (err) {
    next(err)
  }
}
