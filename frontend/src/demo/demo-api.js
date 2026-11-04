import { ApiError } from '../services/api-client'
import { demoServices } from './services'
import { demoAddresses } from './addresses'
import { createDemoOrders } from './orders'
import { demoUser } from './user'
import { isActive } from '../features/orders/components/OrderStatusBadge'

// DEMO ADAPTER — mimics the agreed REST responses using in-browser fixtures.
// Nothing here is persistent or secure. Replace by setting VITE_USE_DEMO=false.

const STORE_KEY = 'wise-laundry-demo-v1'
const SESSION_KEY = 'wise-laundry-demo-session'

const wait = (ms = 300 + Math.random() * 250) => new Promise((r) => setTimeout(r, ms))
const clone = (v) => structuredClone(v)

function seed() {
  return { user: clone(demoUser), addresses: clone(demoAddresses), orders: createDemoOrders(), nextRef: 1045, keys: {} }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* storage unavailable */ }
  return seed()
}

let db = load()
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)) } catch { /* ignore */ }
}

function requireSession() {
  let ok = false
  try { ok = sessionStorage.getItem(SESSION_KEY) === '1' } catch { ok = true }
  if (!ok) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.')
}

const serviceById = (id) => demoServices.find((s) => s.id === id)

function toOrder(o) {
  const history = [...o.statusHistory].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))
  const current = history.at(-1)
  const priced = o.items.every((i) => i.quantity != null)
  return {
    ...clone(o),
    statusHistory: history,
    currentStatus: current.status,
    updatedAt: current.changedAt,
    totalPaise: priced ? Math.round(o.items.reduce((t, i) => t + i.quantity * i.unitPricePaise, 0)) : null,
    currency: 'INR',
  }
}

function findOrder(id) {
  const o = db.orders.find((x) => x.id === id)
  if (!o) throw new ApiError(404, 'NOT_FOUND', 'We could not find that order.')
  return o
}

export const demoApi = {
  async login({ email, password }) {
    await wait()
    if (!email || !password) throw new ApiError(400, 'VALIDATION_ERROR', 'Enter your email and password.')
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
    return { data: clone(db.user) }
  },
  async register({ fullName, email, phone }) {
    await wait()
    db.user = { ...db.user, fullName, email, phone }
    save()
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
    return { data: clone(db.user) }
  },
  async logout() {
    await wait(150)
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    return null
  },
  async me() {
    await wait(120)
    requireSession()
    return { data: clone(db.user) }
  },
  async updateMe({ fullName, phone }) {
    await wait()
    requireSession()
    db.user = { ...db.user, fullName, phone }
    save()
    return { data: clone(db.user) }
  },

  async listServices() {
    await wait(200)
    return { data: clone(demoServices.filter((s) => s.active)) }
  },

  async listAddresses() {
    await wait(200)
    requireSession()
    return { data: clone(db.addresses) }
  },
  async createAddress(body) {
    await wait()
    requireSession()
    const address = { ...body, id: `address_${Date.now()}` }
    if (address.isDefault || db.addresses.length === 0) {
      db.addresses.forEach((a) => (a.isDefault = false))
      address.isDefault = true
    }
    db.addresses.push(address)
    save()
    return { data: clone(address) }
  },
  async updateAddress(id, body) {
    await wait()
    requireSession()
    const a = db.addresses.find((x) => x.id === id)
    if (!a) throw new ApiError(404, 'NOT_FOUND', 'Address not found.')
    if (body.isDefault) db.addresses.forEach((x) => (x.isDefault = false))
    Object.assign(a, body)
    save()
    return { data: clone(a) }
  },
  async deleteAddress(id) {
    await wait()
    requireSession()
    const removed = db.addresses.find((x) => x.id === id)
    db.addresses = db.addresses.filter((x) => x.id !== id)
    if (removed?.isDefault && db.addresses[0]) db.addresses[0].isDefault = true
    save()
    return null
  },

  async createOrder({ items, addressId, pickupScheduledAt, pickupSlotHours, instructions }, idempotencyKey) {
    await wait(700)
    requireSession()
    if (idempotencyKey && db.keys[idempotencyKey]) return { data: toOrder(findOrder(db.keys[idempotencyKey])) }

    const service = serviceById(items?.[0]?.serviceId)
    const address = db.addresses.find((a) => a.id === addressId)
    const fields = {}
    if (!service) fields['items.0.serviceId'] = 'Choose a service.'
    if (!address) fields.addressId = 'Choose a pickup address.'
    if (!pickupScheduledAt || new Date(pickupScheduledAt) < new Date()) fields.pickupScheduledAt = 'Pick a future time.'
    if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the booking details.', fields)

    const { id: _id, isDefault: _d, ...addressSnapshot } = address
    const now = new Date().toISOString()
    const order = {
      id: `order_${db.nextRef}`,
      reference: `WL-${db.nextRef}`,
      items: [{ serviceId: service.id, serviceName: service.name, pricingUnit: service.pricingUnit, quantity: null, unitPricePaise: service.unitPricePaise }],
      addressSnapshot,
      pickupScheduledAt,
      pickupSlotHours,
      instructions: instructions?.trim() ?? '',
      estimatedDeliveryAt: null,
      statusHistory: [{ status: 'BOOKED', changedAt: now, note: 'Pickup requested by you.' }],
      createdAt: now,
    }
    db.nextRef += 1
    db.orders.unshift(order)
    if (idempotencyKey) db.keys[idempotencyKey] = order.id
    save()
    return { data: toOrder(order) }
  },

  async listOrders({ status = 'all', page = 1, pageSize = 10 } = {}) {
    await wait()
    requireSession()
    let list = db.orders.map(toOrder).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (status === 'active') list = list.filter((o) => isActive(o.currentStatus))
    if (status === 'past') list = list.filter((o) => !isActive(o.currentStatus))
    const start = (page - 1) * pageSize
    return { data: list.slice(start, start + pageSize), meta: { page, pageSize, total: list.length } }
  },
  async getOrder(id) {
    await wait()
    requireSession()
    return { data: toOrder(findOrder(id)) }
  },
  async getTracking(id) {
    await wait(250)
    requireSession()
    const o = toOrder(findOrder(id))
    return {
      data: {
        orderId: o.id,
        reference: o.reference,
        serviceId: o.items[0].serviceId,
        currentStatus: o.currentStatus,
        estimatedDeliveryAt: o.estimatedDeliveryAt,
        updatedAt: o.updatedAt,
        history: o.statusHistory,
      },
    }
  },

  /** DEMO ONLY — moves an order to its next stage so the tracking UI can be presented. */
  async demoAdvance(id) {
    await wait(250)
    const o = findOrder(id)
    const current = toOrder(o).currentStatus
    const stages = serviceById(o.items[0].serviceId).stages
    const next = stages[stages.indexOf(current) + 1]
    if (!next) return { data: toOrder(o) }
    o.statusHistory.push({ status: next, changedAt: new Date().toISOString() })
    if (next === 'RECEIVED' && o.items[0].quantity == null) {
      const piece = o.items[0].pricingUnit === 'PIECE'
      o.items[0].quantity = piece ? 6 : 3.5
      o.statusHistory.at(-1).note = piece ? '6 items counted. Final price confirmed.' : 'Weighed at 3.5 kg. Final price confirmed.'
      o.estimatedDeliveryAt = new Date(Date.now() + serviceById(o.items[0].serviceId).turnaroundHours * 3600e3).toISOString()
    }
    save()
    return { data: toOrder(o) }
  },

  resetDemo() {
    db = seed()
    save()
  },
}
