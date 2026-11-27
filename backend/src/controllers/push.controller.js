import * as pushService from '../services/push.service.js'

export async function getKey(req, res) {
  return res.json({ data: { publicKey: pushService.publicKey() } })
}

export async function subscribe(req, res, next) {
  try {
    await pushService.saveSubscription(req.user._id, req.body?.subscription, req.get('user-agent') || '')
    return res.status(201).json({ data: { ok: true } })
  } catch (err) {
    next(err)
  }
}

export async function unsubscribe(req, res, next) {
  try {
    await pushService.removeSubscription(req.body?.endpoint)
    return res.json({ data: { ok: true } })
  } catch (err) {
    next(err)
  }
}
