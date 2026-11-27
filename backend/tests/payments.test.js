import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { config } from '../src/config/env.js'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'
import { User } from '../src/models/User.js'

const HOUR = 60 * 60 * 1000

describe('UPI payments', () => {
  let server
  let baseUrl
  let savedUpi
  before(async () => {
    await setupTestDb()
    savedUpi = config.UPI_ID
    config.UPI_ID = 'wiselaundry@ybl' // pretend UPI is configured for these tests
    config.UPI_PAYEE_NAME = 'Wise Laundry'
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
  })
  after(async () => { config.UPI_ID = savedUpi; server.close(); await teardownTestDb() })
  beforeEach(async () => { await clearTestDb() })

  const headers = (cookie) => ({ 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' })
  const post = (cookie, path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body ?? {}) })
  const get = (cookie, path) => fetch(`${baseUrl}${path}`, { headers: headers(cookie) })

  async function signup(email, role, fullName = 'Pay Tester') {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName, email, phone: '9876543210', password: 'Password123!' }),
    })
    const cookie = reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    if (role) await User.updateOne({ email }, { $set: { role } })
    return cookie
  }

  async function bookAndBill(customer, staff) {
    const { data: address } = await (await post(customer, '/addresses', {
      label: 'HOME', recipientName: 'Asha', phone: '9876543210', addressLine1: 'Villa 2', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    const when = new Date(Date.now() + 30 * HOUR); when.setUTCMinutes(0, 0, 0)
    const order = (await (await post(customer, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: when.toISOString() })).json()).data
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'PICKED_UP' } })
    await post(staff, `/staff/orders/${order.reference}/bill`, { quantity: 4 }) // 4 kg x 60 = 240
    return order
  }

  test('no UPI link before the bill is ready; link appears after billing', async () => {
    const customer = await signup('asha@example.com')
    const { data: address } = await (await post(customer, '/addresses', {
      label: 'HOME', recipientName: 'Asha', phone: '9876543210', addressLine1: 'Villa 2', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    const when = new Date(Date.now() + 30 * HOUR); when.setUTCMinutes(0, 0, 0)
    const order = (await (await post(customer, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: when.toISOString() })).json()).data

    let view = (await (await get(customer, `/orders/${order.id}`)).json()).data
    assert.equal(view.upiPayment, null)
    assert.equal(view.payment.status, 'UNPAID')

    const staff = await signup('staff@example.com', 'STAFF')
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'PICKED_UP' } })
    await post(staff, `/staff/orders/${order.reference}/bill`, { quantity: 4 })

    view = (await (await get(customer, `/orders/${order.id}`)).json()).data
    assert.equal(view.upiPayment.amount, '240.00')
    assert.match(view.upiPayment.link, /^upi:\/\/pay\?pa=wiselaundry%40ybl/)
    assert.match(view.upiPayment.link, /am=240\.00/)
    assert.match(view.upiPayment.link, new RegExp(`tn=.*${order.reference}`))
  })

  test('customer marks paid -> pending; staff confirm -> paid; link then hidden', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const order = await bookAndBill(customer, staff)

    const res = await post(customer, `/orders/${order.id}/pay`, { upiRef: '402212345678' })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).data.payment.status, 'PENDING')

    // staff see it as pending with the reference
    const saved = await Order.findOne({ reference: order.reference })
    assert.equal(saved.payment.upiRef, '402212345678')

    const confirm = await post(staff, `/staff/orders/${order.reference}/payment`, { status: 'PAID', method: 'UPI' })
    const paid = (await confirm.json()).data
    assert.equal(paid.payment.status, 'PAID')
    assert.equal(paid.payment.method, 'UPI')
    // Paid orders no longer show a pay link
    const view = (await (await get(customer, `/orders/${order.id}`)).json()).data
    assert.equal(view.upiPayment, null)
    assert.equal(view.payment.status, 'PAID')
  })

  test('staff mark cash paid; can undo to unpaid', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const order = await bookAndBill(customer, staff)
    const paid = (await (await post(staff, `/staff/orders/${order.reference}/payment`, { status: 'PAID', method: 'CASH' })).json()).data
    assert.equal(paid.payment.status, 'PAID')
    assert.equal(paid.payment.method, 'CASH')
    const undone = (await (await post(staff, `/staff/orders/${order.reference}/payment`, { status: 'UNPAID' })).json()).data
    assert.equal(undone.payment.status, 'UNPAID')
    assert.equal(undone.payment.method, null)
  })

  test('cannot mark paid before the bill exists; PAID needs a method', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const { data: address } = await (await post(customer, '/addresses', {
      label: 'HOME', recipientName: 'Asha', phone: '9876543210', addressLine1: 'Villa 2', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    const when = new Date(Date.now() + 30 * HOUR); when.setUTCMinutes(0, 0, 0)
    const order = (await (await post(customer, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: when.toISOString() })).json()).data

    assert.equal((await post(customer, `/orders/${order.id}/pay`, {})).status, 409)
    assert.equal((await post(staff, `/staff/orders/${order.reference}/payment`, { status: 'PAID', method: 'UPI' })).status, 409)
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'PICKED_UP' } })
    await post(staff, `/staff/orders/${order.reference}/bill`, { quantity: 4 })
    assert.equal((await post(staff, `/staff/orders/${order.reference}/payment`, { status: 'PAID' })).status, 400) // no method
  })

  test('a rider can record payment only for their own job', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const order = await bookAndBill(customer, staff)
    await signup('ravi@example.com', 'RIDER', 'Ravi')
    const rider = await User.findOne({ email: 'ravi@example.com' })
    const login = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' }, body: JSON.stringify({ email: 'ravi@example.com', password: 'Password123!' }) })
    const riderCookie = login.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]

    // Not their job yet
    assert.equal((await post(riderCookie, `/staff/orders/${order.reference}/payment`, { status: 'PAID', method: 'UPI' })).status, 403)
    await post(staff, `/staff/orders/${order.reference}/rider`, { riderId: String(rider._id) })
    const paid = (await (await post(riderCookie, `/staff/orders/${order.reference}/payment`, { status: 'PAID', method: 'UPI' })).json()).data
    assert.equal(paid.payment.status, 'PAID')
    assert.equal((await Order.findOne({ reference: order.reference })).payment.confirmedBy, 'Ravi')
  })

  test('another customer cannot mark my order paid', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const order = await bookAndBill(customer, staff)
    const other = await signup('other@example.com')
    assert.equal((await post(other, `/orders/${order.id}/pay`, {})).status, 403)
  })

  test('a rider cannot deliver until payment is marked paid', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const order = await bookAndBill(customer, staff) // PICKED_UP + billed 240
    await signup('ravi@example.com', 'RIDER', 'Ravi')
    const riderUser = await User.findOne({ email: 'ravi@example.com' })
    await post(staff, `/staff/orders/${order.reference}/rider`, { riderId: String(riderUser._id) })
    const login = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' }, body: JSON.stringify({ email: 'ravi@example.com', password: 'Password123!' }) })
    const rider = login.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    // move it out for delivery (via staff)
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'WASHING' } })
    await post(staff, `/staff/orders/${order.reference}/status`, { from: 'WASHING' })
    const code = (await (await get(customer, `/orders/${order.id}`)).json()).data.deliveryCode

    // rider tries to deliver while unpaid -> blocked
    const blocked = await post(rider, `/staff/orders/${order.reference}/status`, { from: 'OUT_FOR_DELIVERY', code })
    assert.equal(blocked.status, 409)
    assert.equal((await blocked.json()).error.code, 'NOT_PAID')

    // rider collects cash, then delivery works
    await post(rider, `/staff/orders/${order.reference}/payment`, { status: 'PAID', method: 'CASH' })
    const done = await post(rider, `/staff/orders/${order.reference}/status`, { from: 'OUT_FOR_DELIVERY', code })
    assert.equal((await done.json()).data.currentStatus, 'DELIVERED')
  })

  test('staff can deliver without payment (override)', async () => {
    const customer = await signup('asha@example.com')
    const staff = await signup('staff@example.com', 'STAFF')
    const order = await bookAndBill(customer, staff)
    await Order.updateOne({ reference: order.reference }, { $set: { currentStatus: 'OUT_FOR_DELIVERY' } })
    const done = await post(staff, `/staff/orders/${order.reference}/status`, { from: 'OUT_FOR_DELIVERY' })
    assert.equal((await done.json()).data.currentStatus, 'DELIVERED')
  })
})
