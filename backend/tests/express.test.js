import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'
import { User } from '../src/models/User.js'

const HOUR = 60 * 60 * 1000
const slotIn = (h) => { const d = new Date(Date.now() + h * HOUR); d.setUTCMinutes(0, 0, 0); return d }

describe('Express delivery', () => {
  let server
  let baseUrl
  before(async () => {
    await setupTestDb()
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
  })
  after(async () => { server.close(); await teardownTestDb() })
  beforeEach(async () => { await clearTestDb() })

  const headers = (cookie) => ({ 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' })
  const post = (cookie, path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body ?? {}) })

  async function signup(email) {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName: 'Express Tester', email, phone: '9876543210', password: 'Password123!' }),
    })
    const cookie = reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    const { data: address } = await (await post(cookie, '/addresses', {
      label: 'HOME', recipientName: 'Express Tester', phone: '9876543210', addressLine1: 'Villa 5', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    return { cookie, address }
  }

  test('services list shows express terms', async () => {
    const { data } = await (await fetch(`${baseUrl}/services`)).json()
    const fold = data.find((s) => s.id === 'service_wash_fold')
    const iron = data.find((s) => s.id === 'service_iron_only')
    assert.deepEqual(fold.express, { turnaroundHours: 24, surchargePercent: 50 })
    assert.equal(iron.express.turnaroundHours, 12)
  })

  test('express order is saved, billed +50% and gets the faster delivery time', async () => {
    const { cookie, address } = await signup('fast@example.com')
    const res = await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString(), express: true })
    assert.equal(res.status, 201)
    const order = (await res.json()).data
    assert.deepEqual(order.express, { surchargePercent: 50, turnaroundHours: 24 })

    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'PICKED_UP' } })
    const staffEmail = 'staff-express@example.com'
    const staff = await signup(staffEmail)
    await User.updateOne({ email: staffEmail }, { $set: { role: 'STAFF' } })
    const before = Date.now()
    const billRes = await post(staff.cookie, `/staff/orders/${order.reference}/bill`, { quantity: 4 })
    assert.equal(billRes.status, 200)
    const saved = await Order.findOne({ reference: order.reference })
    // 4 kg × ₹60 = ₹240, express +50% = ₹120 → ₹360
    assert.equal(saved.bill.totalPaise, 36000)
    assert.equal(saved.bill.lines[1].label, 'Express delivery')
    const hours = (saved.estimatedDeliveryAt.getTime() - before) / HOUR
    assert.ok(hours > 23.9 && hours < 24.1, `delivery in ~24h, got ${hours}`)
  })

  test('standard order has no express charge', async () => {
    const { cookie, address } = await signup('normal@example.com')
    const order = (await (await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString() })).json()).data
    assert.equal(order.express, null)
  })

  test('standard order can switch to express within 3 hours, and back', async () => {
    const { cookie, address } = await signup('switch@example.com')
    const order = (await (await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString() })).json()).data
    assert.equal(order.expressRules.canUpgrade, true)
    assert.equal(order.expressRules.canDowngrade, false)
    const deadline = new Date(order.expressRules.deadline).getTime() - new Date(order.createdAt).getTime()
    assert.equal(deadline, 3 * HOUR)

    let res = await post(cookie, `/orders/${order.id}/express`, { express: true })
    assert.equal(res.status, 200)
    let data = (await res.json()).data
    assert.deepEqual(data.express, { surchargePercent: 50, turnaroundHours: 24 })
    assert.equal(data.expressRules.canDowngrade, true)

    res = await post(cookie, `/orders/${order.id}/express`, { express: false })
    data = (await res.json()).data
    assert.equal(data.express, null)
  })

  test('switching after 3 hours is refused', async () => {
    const { cookie, address } = await signup('late@example.com')
    const order = (await (await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString() })).json()).data
    await Order.collection.updateOne({ reference: order.reference }, { $set: { createdAt: new Date(Date.now() - 3 * HOUR - 60000) } })
    const res = await post(cookie, `/orders/${order.id}/express`, { express: true })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'EXPRESS_SWITCH_CLOSED')
  })

  test('switching after the bill is made redoes the bill and delivery time', async () => {
    const { cookie, address } = await signup('rebill@example.com')
    const order = (await (await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString() })).json()).data
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'PICKED_UP' } })
    const staffEmail = 'staff-rebill@example.com'
    const staff = await signup(staffEmail)
    await User.updateOne({ email: staffEmail }, { $set: { role: 'STAFF' } })
    await post(staff.cookie, `/staff/orders/${order.reference}/bill`, { quantity: 4 })
    let saved = await Order.findOne({ reference: order.reference })
    assert.equal(saved.bill.totalPaise, 24000)
    const standardEta = saved.estimatedDeliveryAt.getTime()

    const res = await post(cookie, `/orders/${order.id}/express`, { express: true })
    assert.equal(res.status, 200)
    saved = await Order.findOne({ reference: order.reference })
    assert.equal(saved.bill.totalPaise, 36000)
    assert.equal(saved.bill.revision, 2)
    assert.ok(Math.abs(standardEta - saved.estimatedDeliveryAt.getTime() - 24 * HOUR) < 5000, 'delivery moved 24h earlier')
  })

  test('cannot switch once out for delivery', async () => {
    const { cookie, address } = await signup('out@example.com')
    const order = (await (await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString() })).json()).data
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'OUT_FOR_DELIVERY' } })
    const res = await post(cookie, `/orders/${order.id}/express`, { express: true })
    assert.equal(res.status, 409)
  })
})
