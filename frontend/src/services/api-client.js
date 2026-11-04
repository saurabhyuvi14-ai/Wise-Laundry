import { demoApi } from '../demo/demo-api'
import { useCallback, useEffect, useRef, useState } from 'react'

// The ONE place real HTTP calls go through. Used once VITE_USE_DEMO=false.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

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
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include', // auth lives in an HttpOnly cookie set by Express
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
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

// Real backend endpoints (guide §10). Same function names as demo/demo-api.js.

export const laundryApi = {
  // auth
  login: (body) => apiClient('/auth/login', { method: 'POST', body }),
  register: (body) => apiClient('/auth/register', { method: 'POST', body }),
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

  // orders
  createOrder: (body, idempotencyKey) =>
    apiClient('/orders', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),
  listOrders: ({ status = 'all', page = 1, pageSize = 10 } = {}) =>
    apiClient(`/orders?status=${status}&page=${page}&pageSize=${pageSize}`),
  getOrder: (id) => apiClient(`/orders/${id}`),
  getTracking: (id, signal) => apiClient(`/orders/${id}/tracking`, { signal }),
}

// Switch between demo fixtures and the real Express API with one env flag.

export const IS_DEMO = import.meta.env.VITE_USE_DEMO !== 'false'
export const api = IS_DEMO ? demoApi : laundryApi

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
