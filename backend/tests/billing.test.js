import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'
import { User } from '../src/models/User.js'
import { config } from '../src/config/env.js'
import { computeBill } from '../src/services/billing.service.js'

const HOUR = 3600e3
const item = { serviceName: 'Wash & Fold', pricingUnit: 'KG', unitPricePaise: 7900 }

describe('Final bill maths', () => {
  const saved = {}
  const set = (k, v) => { saved[k] ??= config[k]; config[k] = v }
  after(() => Object.assign(config, saved))

  test('plain bill is quantity × rate, rounded to the paisa', () => {
    const b = computeBill(item, 3.5)
    assert.equal(b.totalPaise, 27650)
    assert.equal(b.lines.length, 1)
    assert.equal(b.lines[0].detail, '3.5 kg × ₹79')
  })

  test('minimum order, delivery fee, free delivery and GST when switched on', () => {
    set('BILL_MIN_ORDER_PAISE', 20000)
    set('BILL_DELIVERY_FEE_PAISE', 4900)
    set('BILL_FREE_DELIVERY_ABOVE_PAISE', 50000)
    set('BILL_GST_PERCENT', 18)
    const small = computeBill(item, 1) // 79 -> top-up to 200, + 49 delivery, + 18% GST
    assert.deepEqual(small.lines.map((l) => l.amountPaise), [7900, 12100, 4900, 4482])
    assert.equal(small.totalPaise, 29382)
    const big = computeBill(item, 10) // 790, free delivery, + GST
    assert.deepEqual(big.lines.map((l) => l.amountPaise), [79000, 0, 14220])
    assert.equal(big.totalPaise, 93220)
    Object.assign(config, saved)
  })
})

describe('Staff billing', () => {
  let server
  let baseUrl

  before(async () => {
    await setupTestDb()
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
  })
  after(async () => {
    server.close()
    await teardownTestDb()
  })
  beforeEach(async () => {
    await clearTestDb()
  })

  const headers = (cookie) => ({ 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' })
  const post = (cookie, path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body) })
  const get = (cookie, path) => fetch(`${baseUrl}${path}`, { headers: headers(cookie) })

  async function account(email) {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName: 'Bill Tester', email, phone: '9876543210', password: 'Password123!' }),
    })
    return reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
  }

  async function bookedOrder(cookie, serviceId = 'service_wash_fold') {
    const addr = await (await post(cookie, '/addresses', {
      label: 'HOME', recipientName: 'Bill Tester', phone: '9876543210',
      addressLine1: 'Villa 12', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    const when = new Date(Date.now() + 24 * HOUR); when.setUTCMinutes(0, 0, 0)
    const res = await post(cookie, '/orders', { items: [{ serviceId }], addressId: addr.data.id, pickupScheduledAt: when.toISOString(), pickupSlotHours: 2 })
    return (await res.json()).data
  }

  async function staff() {
    const cookie = await account('staff@example.com')
    await User.updateOne({ email: 'staff@example.com' }, { $set: { role: 'STAFF' } })
    return cookie
  }

  test('customers cannot use staff tools', async () => {
    const cust = await account('cust@example.com')
    const order = await bookedOrder(cust)
    assert.equal((await get(cust, `/staff/orders/${order.reference}`)).status, 403)
    assert.equal((await post(cust, `/staff/orders/${order.reference}/bill`, { quantity: 3 })).status, 403)
  })

  test('staff weigh a picked-up order: bill saved, order moves to At laundry, customer sees it', async () => {
    const cust = await account('cust2@example.com')
    const order = await bookedOrder(cust)
    await Order.updateOne({ orderIdString: order.id }, { $set: { currentStatus: 'PICKED_UP' } })
    const s = await staff()

    const look = await get(s, `/staff/orders/${order.reference.toLowerCase()}`)
    assert.equal(look.status, 200)
    const looked = (await look.json()).data
    assert.equal(looked.customer.fullName, 'Bill Tester')
    assert.equal(looked.canBill, true)

    const res = await post(s, `/staff/orders/${order.reference}/bill`, { quantity: 4.5 })
    assert.equal(res.status, 200)
    const billed = (await res.json()).data
    assert.equal(billed.currentStatus, 'RECEIVED')
    assert.equal(billed.items[0].quantity, 4.5)
    assert.equal(billed.bill.totalPaise, Math.round(4.5 * billed.items[0].unitPricePaise))
    assert.equal(billed.bill.revision, 1)
    assert.match(billed.statusHistory.at(-1).note, /Weighed at 4.5 kg/)
    assert.ok(billed.estimatedDeliveryAt)

    const mine = (await (await get(cust, `/orders/${order.id}`)).json()).data
    assert.equal(mine.totalPaise, billed.bill.totalPaise)
    assert.equal(mine.bill.lines[0].detail.startsWith('4.5 kg'), true)
  })

  test('staff can correct the bill until it goes out for delivery, without extra timeline steps', async () => {
    const cust = await account('cust3@example.com')
    const order = await bookedOrder(cust)
    await Order.updateOne({ orderIdString: order.id }, { $set: { currentStatus: 'PICKED_UP' } })
    const s = await staff()
    await post(s, `/staff/orders/${order.id}/bill`, { quantity: 4 })
    const fixed = (await (await post(s, `/staff/orders/${order.id}/bill`, { quantity: 3.5 })).json()).data
    assert.equal(fixed.bill.revision, 2)
    assert.equal(fixed.items[0].quantity, 3.5)
    assert.equal(fixed.statusHistory.filter((h) => h.status === 'RECEIVED').length, 1)

    await Order.updateOne({ orderIdString: order.id }, { $set: { currentStatus: 'OUT_FOR_DELIVERY' } })
    const late = await post(s, `/staff/orders/${order.id}/bill`, { quantity: 5 })
    assert.equal(late.status, 409)
  })

  test('a booked (not picked up) order cannot be billed', async () => {
    const cust = await account('cust4@example.com')
    const order = await bookedOrder(cust)
    const s = await staff()
    const res = await post(s, `/staff/orders/${order.id}/bill`, { quantity: 3 })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ORDER_NOT_BILLABLE')
  })

  test('bad weights and counts are refused', async () => {
    const cust = await account('cust5@example.com')
    const kg = await bookedOrder(cust)
    const pc = await bookedOrder(cust, 'service_iron_only')
    await Order.updateMany({}, { $set: { currentStatus: 'PICKED_UP' } })
    const s = await staff()
    for (const q of [0, -1, 150, 1.25, 'abc']) {
      assert.equal((await post(s, `/staff/orders/${kg.id}/bill`, { quantity: q })).status, 400, `kg ${q}`)
    }
    for (const q of [0, 2.5, 501]) {
      assert.equal((await post(s, `/staff/orders/${pc.id}/bill`, { quantity: q })).status, 400, `pieces ${q}`)
    }
    assert.equal((await post(s, `/staff/orders/${pc.id}/bill`, { quantity: 8 })).status, 200)
  })
})
