import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'
import { User } from '../src/models/User.js'

const HOUR = 60 * 60 * 1000

describe('Staff work list', () => {
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
  const get = (cookie, path) => fetch(`${baseUrl}${path}`, { headers: headers(cookie) })

  async function signup(email, role) {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName: 'Work Tester', email, phone: '9876543210', password: 'Password123!' }),
    })
    const cookie = reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    if (role) await User.updateOne({ email }, { $set: { role } })
    return cookie
  }

  async function book(cookie, hoursAhead) {
    const { data: address } = await (await post(cookie, '/addresses', {
      label: 'HOME', recipientName: 'Asha', phone: '9876543210', addressLine1: 'Villa 9', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066', instructions: 'Ring the bell.',
    })).json()
    const when = new Date(Date.now() + hoursAhead * HOUR); when.setUTCMinutes(0, 0, 0)
    const res = await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: when.toISOString(), instructions: 'Call before coming.' })
    return (await res.json()).data
  }

  test('customers cannot see the work list', async () => {
    const cookie = await signup('cust@example.com')
    assert.equal((await get(cookie, '/staff/work')).status, 403)
  })

  test('staff see orders grouped, with name, address and instructions', async () => {
    const customer = await signup('asha@example.com')
    const later = await book(customer, 30)
    const inWash = await book(customer, 32)
    await Order.updateOne({ reference: inWash.reference }, { $set: { currentStatus: 'WASHING' } })
    const out = await book(customer, 34)
    await Order.updateOne({ reference: out.reference }, { $set: { currentStatus: 'OUT_FOR_DELIVERY' } })

    const staff = await signup('staff@example.com', 'STAFF')
    const pickupDay = new Date(new Date(later.pickupScheduledAt).getTime() + 5.5 * HOUR).toISOString().slice(0, 10)
    const res = await get(staff, `/staff/work?day=${pickupDay}`)
    assert.equal(res.status, 200)
    const { data } = await res.json()
    assert.equal(data.day, pickupDay)
    assert.ok(data.groups.toPickup.some((c) => c.reference === later.reference))
    const card = data.groups.toPickup.find((c) => c.reference === later.reference)
    assert.equal(card.customer.fullName, 'Work Tester')
    assert.equal(card.address.line1, 'Villa 9')
    assert.equal(card.instructions, 'Call before coming.')
    assert.deepEqual(data.groups.atLaundry.map((c) => c.reference), [inWash.reference])
    assert.deepEqual(data.groups.toDeliver.map((c) => c.reference), [out.reference])
  })

  test('a bad date is rejected', async () => {
    const staff = await signup('staff2@example.com', 'STAFF')
    assert.equal((await get(staff, '/staff/work?day=nope')).status, 400)
  })
})
