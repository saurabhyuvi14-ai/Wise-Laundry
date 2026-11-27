import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'
import { User } from '../src/models/User.js'

const HOUR = 60 * 60 * 1000

describe('Team and riders', () => {
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

  async function signup(email, role, fullName = 'Team Tester') {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName, email, phone: '9876543210', password: 'Password123!' }),
    })
    const cookie = reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    if (role) await User.updateOne({ email }, { $set: { role } })
    return cookie
  }

  async function book(cookie) {
    const { data: address } = await (await post(cookie, '/addresses', {
      label: 'HOME', recipientName: 'Asha', phone: '9876543210', addressLine1: 'Villa 1', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    const when = new Date(Date.now() + 30 * HOUR); when.setUTCMinutes(0, 0, 0)
    return (await (await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: when.toISOString() })).json()).data
  }

  test('only admin manages the team, and not their own role', async () => {
    const admin = await signup('admin@example.com', 'ADMIN')
    const staff = await signup('staff@example.com', 'STAFF')
    await signup('ravi@example.com', null, 'Ravi')

    assert.equal((await post(staff, '/staff/team', { email: 'ravi@example.com', role: 'RIDER' })).status, 403)
    const res = await post(admin, '/staff/team', { email: 'ravi@example.com', role: 'RIDER' })
    assert.equal((await res.json()).data.role, 'RIDER')
    assert.equal((await post(admin, '/staff/team', { email: 'admin@example.com', role: 'CUSTOMER' })).status, 400)
    assert.equal((await post(admin, '/staff/team', { email: 'nobody@example.com', role: 'RIDER' })).status, 400)
    const team = (await (await get(admin, '/staff/team')).json()).data
    assert.deepEqual(team.map((u) => u.role).sort(), ['ADMIN', 'RIDER', 'STAFF'])
  })

  test('riders see and move only their own jobs, and only rider steps', async () => {
    const customer = await signup('cust@example.com')
    const mine = await book(customer)
    const other = await book(customer)
    const staff = await signup('staff@example.com', 'STAFF')
    const rider = await signup('ravi@example.com', 'RIDER', 'Ravi')
    const riderId = String((await User.findOne({ email: 'ravi@example.com' }))._id)

    assert.equal((await post(staff, `/staff/orders/${mine.reference}/rider`, { riderId })).status, 200)
    const riders = (await (await get(staff, '/staff/riders')).json()).data
    assert.deepEqual(riders.map((r) => r.fullName), ['Ravi'])

    const day = new Date(new Date(mine.pickupScheduledAt).getTime() + 5.5 * HOUR).toISOString().slice(0, 10)
    const work = (await (await get(rider, `/staff/work?day=${day}`)).json()).data
    assert.deepEqual(work.groups.toPickup.map((c) => c.reference), [mine.reference])
    assert.equal(work.groups.toPickup[0].rider.fullName, 'Ravi')

    assert.equal((await post(rider, `/staff/orders/${other.reference}/status`, { from: 'BOOKED' })).status, 403)
    // Riders must weigh at the doorstep when picking up.
    assert.equal((await post(rider, `/staff/orders/${mine.reference}/status`, { from: 'BOOKED' })).status, 400)
    const picked = (await (await post(rider, `/staff/orders/${mine.reference}/status`, { from: 'BOOKED', quantity: 4 })).json()).data
    assert.equal(picked.currentStatus, 'PICKED_UP')
    assert.equal(picked.bill.totalPaise, 24000)
    assert.equal(picked.statusHistory.at(-1).note, 'Weighed at 4 kg by Ravi. Final bill ready.')
    assert.equal((await post(rider, `/staff/orders/${mine.reference}/status`, { from: 'PICKED_UP' })).status, 200)
    // Washing is a laundry-staff step.
    assert.equal((await post(rider, `/staff/orders/${mine.reference}/status`, { from: 'RECEIVED' })).status, 403)
    // Riders can't use staff-only tools.
    assert.equal((await get(rider, '/staff/riders')).status, 403)
    assert.equal((await post(rider, `/staff/orders/${mine.reference}/bill`, { quantity: 2 })).status, 403)
  })

  test('removing a rider takes their jobs back', async () => {
    const admin = await signup('admin@example.com', 'ADMIN')
    const customer = await signup('cust@example.com')
    const order = await book(customer)
    await signup('ravi@example.com', 'RIDER', 'Ravi')
    const rider = await User.findOne({ email: 'ravi@example.com' })
    await post(admin, `/staff/orders/${order.reference}/rider`, { riderId: String(rider._id) })
    await post(admin, '/staff/team', { email: 'ravi@example.com', role: 'CUSTOMER' })
    assert.equal((await Order.findOne({ reference: order.reference })).riderId, null)
  })

  test('staff can correct the doorstep weight later', async () => {
    const customer = await signup('cust@example.com')
    const order = await book(customer)
    const staff = await signup('staff@example.com', 'STAFF')
    await signup('ravi@example.com', 'RIDER', 'Ravi')
    const rider = await User.findOne({ email: 'ravi@example.com' })
    await post(staff, `/staff/orders/${order.reference}/rider`, { riderId: String(rider._id) })
    const riderCookie = await (async () => {
      const res = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' }, body: JSON.stringify({ email: 'ravi@example.com', password: 'Password123!' }) })
      return res.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    })()
    await post(riderCookie, `/staff/orders/${order.reference}/status`, { from: 'BOOKED', quantity: 4 })
    const fixed = (await (await post(staff, `/staff/orders/${order.reference}/bill`, { quantity: 5 })).json()).data
    assert.equal(fixed.bill.totalPaise, 30000)
    assert.equal(fixed.bill.revision, 2)
  })

  test('customer sees the rider only while the rider is coming to them', async () => {
    const customer = await signup('cust@example.com')
    const order = await book(customer)
    const staff = await signup('staff@example.com', 'STAFF')
    await signup('ravi@example.com', 'RIDER', 'Ravi')
    const rider = await User.findOne({ email: 'ravi@example.com' })
    const view = async () => (await (await get(customer, `/orders/${order.id}`)).json()).data

    assert.equal((await view()).rider, null)
    await post(staff, `/staff/orders/${order.reference}/rider`, { riderId: String(rider._id) })
    const booked = await view()
    assert.deepEqual(booked.rider, { fullName: 'Ravi', phone: '9876543210' })
    assert.equal(booked.riderId, undefined)

    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'WASHING' } })
    assert.equal((await view()).rider, null)
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'OUT_FOR_DELIVERY' } })
    assert.equal((await view()).rider.fullName, 'Ravi')
    const tracking = (await (await get(customer, `/orders/${order.id}/tracking`)).json()).data
    assert.equal(tracking.rider.fullName, 'Ravi')
  })
})
