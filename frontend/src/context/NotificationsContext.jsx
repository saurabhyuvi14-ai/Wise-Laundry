import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../services/api-client'
import { useToast } from '../components/feedback/Toast'
import { STATUS } from '../features/orders/components/OrderStatusBadge'

const NotificationsContext = createContext(null)
const POLL_MS = 45_000

/**
 * Keeps the customer's updates feed fresh while the app is open.
 * Checks every 45s (and when the tab comes back), and pops a toast for anything new.
 */
export function NotificationsProvider({ children }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [ring, setRing] = useState(0) // bumps when something new arrives, so the bell can wiggle
  const known = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await api.listNotifications()
      const list = res.data ?? []
      if (known.current) {
        const fresh = list.filter((n) => n.unread && !known.current.has(n.id))
        if (fresh.length) {
          const n = fresh[0]
          toast(fresh.length === 1 ? `${n.reference}: ${notificationText(n)}` : `${fresh.length} new updates on your orders`)
          setRing((r) => r + 1)
        }
      }
      known.current = new Set(list.map((n) => n.id))
      setItems(list)
      setUnreadCount(res.meta?.unreadCount ?? 0)
    } catch {
      // Offline or signed out: keep what we have, try again next tick.
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const markSeen = useCallback(async () => {
    setUnreadCount(0)
    try { await api.markNotificationsSeen() } catch { /* not important */ }
  }, [])

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, loading, ring, reload: load, markSeen }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationsContext) ?? { items: [], unreadCount: 0, loading: false, ring: 0, reload() {}, markSeen() {} }

/** One-line text for an update. */
export function notificationText(n) {
  if (n.kind === 'RESCHEDULED') return 'Pickup time changed.'
  return STATUS[n.status]?.message ?? n.status
}
