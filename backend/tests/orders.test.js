import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'

describe('Orders, Idempotency & Live Tracking', () => {
  let server
  let baseUrl

  before(async () => {
    await setupTestDb()
    server = app.listen(0)
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}/api/v1`
  })

  after(async () => {
    server.close()
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  async function setupCustomer(email) {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        fullName: 'Customer Test',
        email,
        phone: '9876543210',
        password: 'Password123!',
      }),
    })
    const cookieHeader = regRes.headers.get('set-cookie')
    const cookie = cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]

    // Create an address
    const addrRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        label: 'HOME',
        recipientName: 'Customer Test',
        phone: '9876543210',
        addressLine1: 'Villa 12, Palm Meadows',
        addressLine2: 'Whitefield',
        city: 'Bengaluru',
        postalCode: '560066',
        instructions: 'Gate 2 security',
      }),
    })
    const { data: address } = await addrRes.json()

    return { cookie, address }
  }

  test('creates an order with encrypted snapshot and initial BOOKED status history', async () => {
    const { cookie, address } = await setupCustomer('cust1@example.com')

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const payload = {
      items: [{ serviceId: 'service_wash_fold' }],
      addressId: address.id,
      pickupScheduledAt: futureDate,
      pickupSlotHours: 2,
      instructions: 'Handle delicate silks carefully',
    }

    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie,
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify(payload),
    })

    assert.equal(res.status, 201)
    const json = await res.json()
    assert.ok(json.data.id)
    assert.ok(json.data.reference.startsWith('WL-'))
    assert.equal(json.data.currentStatus, 'BOOKED')
    assert.equal(json.data.items[0].serviceName, 'Wash & Fold')
    assert.equal(json.data.instructions, 'Handle delicate silks carefully')
    assert.equal(json.data.addressSnapshot.addressLine1, 'Villa 12, Palm Meadows')
    assert.equal(json.data.statusHistory.length, 1)
    assert.equal(json.data.statusHistory[0].status, 'BOOKED')

    // Inspect database at rest: verify address snapshot and instructions are encrypted
    const rawOrder = await Order.findOne({ reference: json.data.reference }).lean()
    assert.ok(rawOrder.addressSnapshot.addressLine1Encrypted.startsWith('v1:'))
    assert.ok(rawOrder.instructionsEncrypted.startsWith('v1:'))
  })

  test('guarantees idempotency: retried booking with identical Idempotency-Key returns existing order', async () => {
    const { cookie, address } = await setupCustomer('cust2@example.com')
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const idempotencyKey = 'unique-key-xyz-789'

    const payload = {
      items: [{ serviceId: 'service_wash_iron' }],
      addressId: address.id,
      pickupScheduledAt: futureDate,
      pickupSlotHours: 2,
    }

    // First call
    const firstRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie,
        'Idempotency-Key': idempotencyKey,
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify(payload),
    })
    assert.equal(firstRes.status, 201)
    const firstJson = await firstRes.json()

    // Second call with same idempotency key
    const secondRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie,
        'Idempotency-Key': idempotencyKey,
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify(payload),
    })
    assert.equal(secondRes.status, 201)
    const secondJson = await secondRes.json()

    // Must return identical existing order
    assert.equal(secondJson.data.id, firstJson.data.id)
    assert.equal(secondJson.data.reference, firstJson.data.reference)

    // Verify only one order was written to database
    const totalOrders = await Order.countDocuments({ idempotencyKey })
    assert.equal(totalOrders, 1)
  })

  test('rejects booking with another customer address (ownership validation)', async () => {
    const userA = await setupCustomer('custA@example.com')
    const userB = await setupCustomer('custB@example.com')

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    // User B tries to use User A's addressId
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userB.cookie,
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify({
        items: [{ serviceId: 'service_wash_fold' }],
        addressId: userA.address.id,
        pickupScheduledAt: futureDate,
      }),
    })

    assert.equal(res.status, 403)
  })

  test('enforces cross-account isolation: User B cannot view User A order or tracking', async () => {
    const userA = await setupCustomer('owner@example.com')
    const userB = await setupCustomer('intruder@example.com')

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userA.cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        items: [{ serviceId: 'service_wash_fold' }],
        addressId: userA.address.id,
        pickupScheduledAt: futureDate,
      }),
    })
    const { data: orderA } = await orderRes.json()

    // User B tries to get order details
    const getRes = await fetch(`${baseUrl}/orders/${orderA.id}`, {
      headers: { cookie: userB.cookie },
    })
    assert.equal(getRes.status, 403)

    // User B tries to get order tracking
    const trackRes = await fetch(`${baseUrl}/orders/${orderA.id}/tracking`, {
      headers: { cookie: userB.cookie },
    })
    assert.equal(trackRes.status, 403)

    // User A can view tracking successfully
    const trackOk = await fetch(`${baseUrl}/orders/${orderA.id}/tracking`, {
      headers: { cookie: userA.cookie },
    })
    assert.equal(trackOk.status, 200)
    const trackJson = await trackOk.json()
    assert.equal(trackJson.data.orderId, orderA.id)
    assert.equal(trackJson.data.currentStatus, 'BOOKED')
  })

  test('simulates order progression in test mode and confirms final pricing at RECEIVED', async () => {
    const userA = await setupCustomer('advance_test@example.com')
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userA.cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        items: [{ serviceId: 'service_wash_fold' }],
        addressId: userA.address.id,
        pickupScheduledAt: futureDate,
      }),
    })
    const { data: order } = await orderRes.json()
    assert.equal(order.currentStatus, 'BOOKED')

    // 1st advance: BOOKED -> PICKED_UP
    const adv1 = await fetch(`${baseUrl}/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { cookie: userA.cookie, 'x-test-bypass-csrf': '1' },
    })
    assert.equal(adv1.status, 200)
    const json1 = await adv1.json()
    assert.equal(json1.data.currentStatus, 'PICKED_UP')

    // 2nd advance: PICKED_UP -> RECEIVED (should populate weighed quantity and estimated delivery)
    const adv2 = await fetch(`${baseUrl}/orders/${order.id}/advance`, {
      method: 'POST',
      headers: { cookie: userA.cookie, 'x-test-bypass-csrf': '1' },
    })
    assert.equal(adv2.status, 200)
    const json2 = await adv2.json()
    assert.equal(json2.data.currentStatus, 'RECEIVED')
    assert.equal(json2.data.items[0].quantity, 3.5)
    assert.ok(json2.data.totalPaise > 0)
    assert.ok(json2.data.estimatedDeliveryAt)
  })
})
