import { useCallback, useEffect, useRef, useState } from 'react'

// The ONE place HTTP calls go through.
// Defaults to '/api/v1' which proxies locally via Vite and routes same-origin in staging/production.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

function getCsrfToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)wise_csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export async function apiClient(path, { method = 'GET', body, headers = {}, signal } = {}) {
  let response
  const csrf = getCsrfToken()
  const defaultHeaders = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...headers,
  }

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include', // auth lives in an HttpOnly cookie set by Express
      headers: defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and retry.')
  }

  if (response.status === 204) return null

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const e = payload?.error ?? {}
    throw new ApiError(response.status, e.code ?? 'UNKNOWN', e.message ?? 'Something went wrong.', e.fields)
  }
  return payload
}

// Backend endpoints (guide §10).

export const laundryApi = {
  // auth
  login: (body) => apiClient('/auth/login', { method: 'POST', body }),
  register: (body) => apiClient('/auth/register', { method: 'POST', body }),
  googleSignIn: (body) => apiClient('/auth/google', { method: 'POST', body }),
  requestOtp: (body) => apiClient('/auth/otp/request', { method: 'POST', body }),
  verifyOtp: (body) => apiClient('/auth/otp/verify', { method: 'POST', body }),
  logout: () => apiClient('/auth/logout', { method: 'POST' }),
  me: () => apiClient('/auth/me'),
  updateMe: (body) => apiClient('/users/me', { method: 'PATCH', body }),

  // catalogue
  listServices: () => apiClient('/services'),

  // addresses
  listAddresses: () => apiClient('/addresses'),
  createAddress: (body) => apiClient('/addresses', { method: 'POST', body }),
  updateAddress: (id, body) => apiClient(`/addresses/${id}`, { method: 'PATCH', body }),
  deleteAddress: (id) => apiClient(`/addresses/${id}`, { method: 'DELETE' }),
  reverseGeocode: (body) => apiClient('/addresses/reverse-geocode', { method: 'POST', body }),
  geocodeAddress: (body) => apiClient('/addresses/geocode', { method: 'POST', body }),

  // orders
  createOrder: (body, idempotencyKey) =>
    apiClient('/orders', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),
  listOrders: ({ status = 'all', page = 1, pageSize = 10 } = {}) =>
    apiClient(`/orders?status=${status}&page=${page}&pageSize=${pageSize}`),
  getOrder: (id) => apiClient(`/orders/${id}`),
  staffWorkList: (day) => apiClient(`/staff/work${day ? `?day=${encodeURIComponent(day)}` : ''}`),
  staffAdvanceStatus: (id, from) => apiClient(`/staff/orders/${encodeURIComponent(id)}/status`, { method: 'POST', body: { from } }),
  staffGetOrder: (id) => apiClient(`/staff/orders/${encodeURIComponent(id)}`),
  staffSaveBill: (id, body) => apiClient(`/staff/orders/${encodeURIComponent(id)}/bill`, { method: 'POST', body }),
  cancelOrder: (id, body) => apiClient(`/orders/${id}/cancel`, { method: 'POST', body }),
  rescheduleOrder: (id, body) => apiClient(`/orders/${id}/reschedule`, { method: 'POST', body }),
  getTracking: (id, signal) => apiClient(`/orders/${id}/tracking`, { signal }),
  setExpress: (id, body) => apiClient(`/orders/${id}/express`, { method: 'POST', body }),
  submitFeedback: (id, body) => apiClient(`/orders/${id}/feedback`, { method: 'POST', body }),

  // updates feed (built from order status changes)
  listNotifications: () => apiClient('/notifications'),
  markNotificationsSeen: () => apiClient('/notifications/seen', { method: 'POST' }),
}

export const api = laundryApi

/** Small data hook: { data, meta, error, loading, reload } for any api.* call. */
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, meta: null, error: null, loading: true })
  const latest = useRef(0)

  const load = useCallback(async ({ silent = false } = {}) => {
    const id = ++latest.current
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetcher()
      if (id === latest.current) setState({ data: res?.data ?? null, meta: res?.meta ?? null, error: null, loading: false })
    } catch (error) {
      if (id === latest.current) setState((s) => ({ ...s, error, loading: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { load() }, [load])

  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) }
}
