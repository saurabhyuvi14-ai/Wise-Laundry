import { api, useApi } from '../../../services/api-client'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useOrders({ status = 'all', page = 1, pageSize = 10 } = {}) {
  return useApi(() => api.listOrders({ status, page, pageSize }), [status, page, pageSize])
}

export function useOrder(orderId) {
  return useApi(() => api.getOrder(orderId), [orderId])
}

const POLL_MS = 15000

/** Periodic fetch while the tab is visible; never overlaps requests (guide §6). */
export function useTracking(orderId) {
  const [state, setState] = useState({ data: null, error: null, loading: true, lastSuccess: null })
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (!orderId || inFlight.current) return
    inFlight.current = true
    try {
      const res = await api.getTracking(orderId)
      setState({ data: res.data, error: null, loading: false, lastSuccess: new Date().toISOString() })
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }))
    } finally {
      inFlight.current = false
    }
  }, [orderId])

  useEffect(() => {
    setState({ data: null, error: null, loading: true, lastSuccess: null })
    refresh()
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  return { ...state, refresh }
}
