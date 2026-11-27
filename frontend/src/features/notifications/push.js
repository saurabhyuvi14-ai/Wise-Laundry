import { api } from '../../services/api-client'

export const pushSupported = () =>
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// VAPID public key (base64url) -> Uint8Array for PushManager.subscribe.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js')
}

/** Current state: 'unsupported' | 'blocked' | 'on' | 'off'. */
export async function pushState() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg && (await reg.pushManager.getSubscription())
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Ask permission, subscribe, and tell the backend. Throws a friendly message on failure. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This device does not support notifications.')
  const { data } = await api.pushKey()
  if (!data.publicKey) throw new Error('Notifications are not set up yet. Please try again later.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Allow notifications in your browser to turn these on.')
  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) }))
  await api.pushSubscribe(sub.toJSON())
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = reg && (await reg.pushManager.getSubscription())
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
}
