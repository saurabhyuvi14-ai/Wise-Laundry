import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'

describe('Orders, Idempotency & Live Tracking', () => {
  before(async () => {
    await setupTestDb()
  })

  after(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  async function createRegisteredUser(name, email) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: name,
        email,
        phone: '9876543210',
        password: 'Password@123',
      })
    return { user: res.body.data, cookie: res.headers['set-cookie'] }
  }

  async function createAddressFor(cookie) {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
      .send({
        label: 'HOME',
        recipientName: 'Test Recipient',
        phone: '9876543210',
        addressLine1: 'B-101, Palm Grove',
        addressLine2: 'Indiranagar 100ft Road',
        city: 'Bengaluru',
        postalCode: '560038',
        isDefault: true,
      })
    return res.body.data
  }

  it('creates an order with encrypted snapshot and initial BOOKED status history', async () => {
    const { cookie } = await createRegisteredUser('Customer One', 'customer1@example.com')
    const address = await createAddressFor(cookie)

    // Future scheduled pickup time
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
      .set('Idempotency-Key', 'test-key-100')
      .send({
        items: [{ serviceId: 'service_wash_fold' }],
        addressId: address.id,
        pickupScheduledAt: futureDate,
        pickupSlotHours: 2,
        instructions: 'Please call before arriving.',
      })

    assert.equal(orderRes.status, 201)
    const order = orderRes.body.data
    assert.ok(order.id)
    assert.ok(order.reference.startsWith('WL-'))
    assert.equal(order.currentStatus, 'BOOKED')
    assert.equal(order.items[0].serviceId, 'service_wash_fold')
    assert.equal(order.items[0].serviceName, 'Wash & Fold')
    assert.equal(order.statusHistory.length, 1)
    assert.equal(order.statusHistory[0].status, 'BOOKED')
    assert.equal(order.addressSnapshot.addressLine1, 'B-101, Palm Grove')

    // Verify raw DB document has encrypted address snapshot
    const rawOrder = await Order.findOne({ reference: order.reference })
    assert.ok(rawOrder)
    assert.ok(rawOrder.addressSnapshot.addressLine1Encrypted.startsWith('v1:'))
    assert.ok(!rawOrder.addressSnapshot.addressLine1Encrypted.includes('Palm Grove'))

    // Verify consistent ID on order details
    const detailsRes = await request(app).get(`/api/v1/orders/${order.id}`).set('Cookie', cookie)
    assert.equal(detailsRes.status, 200)
    assert.equal(detailsRes.body.data.id, order.id)
    assert.equal(detailsRes.body.data.reference, order.reference)

    // Verify consistent ID on live tracking
    const trackingRes = await request(app).get(`/api/v1/orders/${order.id}/tracking`).set('Cookie', cookie)
    assert.equal(trackingRes.status, 200)
    assert.equal(trackingRes.body.data.orderId, order.id)
    assert.equal(trackingRes.body.data.reference, order.reference)
    assert.equal(trackingRes.body.data.currentStatus, 'BOOKED')
  })

  it('guarantees idempotency: retried booking with identical Idempotency-Key returns existing order', async () => {
    const { cookie } = await createRegisteredUser('Customer Retry', 'retry@example.com')
    const address = await createAddressFor(cookie)
    const futureDate = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    const idempotencyKey = 'unique-client-uuid-999'

    // First booking attempt
    const res1 = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        items: [{ serviceId: 'service_wash_iron' }],
        addressId: address.id,
        pickupScheduledAt: futureDate,
        pickupSlotHours: 2,
      })
    assert.equal(res1.status, 201)
    const orderId1 = res1.body.data.id

    // Second booking attempt with same key (simulating network retry)
    const res2 = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        items: [{ serviceId: 'service_wash_iron' }],
        addressId: address.id,
        pickupScheduledAt: futureDate,
        pickupSlotHours: 2,
      })
    assert.equal(res2.status, 200)
    assert.equal(res2.body.data.id, orderId1)

    // Total orders count must be 1
    const totalOrders = await Order.countDocuments()
    assert.equal(totalOrders, 1)
  })

  it('rejects booking with another customer address (ownership validation)', async () => {
    const userA = await createRegisteredUser('User A', 'user_a_order@example.com')
    const userB = await createRegisteredUser('User B', 'user_b_order@example.com')
    const addressA = await createAddressFor(userA.cookie)

    const futureDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

    // User B attempts to book using User A's addressId
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', userB.cookie)
      .set('x-test-bypass-csrf', '1')
      .send({
        items: [{ serviceId: 'service_wash_fold' }],
        addressId: addressA.id,
        pickupScheduledAt: futureDate,
        pickupSlotHours: 2,
      })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'FORBIDDEN')
  })

  it('enforces cross-account isolation: User B cannot view User A order or tracking', async () => {
    const userA = await createRegisteredUser('User A', 'usera_track@example.com')
    const userB = await createRegisteredUser('User B', 'userb_track@example.com')
    const addressA = await createAddressFor(userA.cookie)

    const futureDate = new Date(Date.now() + 36 * 3600 * 1000).toISOString()
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', userA.cookie)
      .set('x-test-bypass-csrf', '1')
      .send({
        items: [{ serviceId: 'service_iron_only' }],
        addressId: addressA.id,
        pickupScheduledAt: futureDate,
        pickupSlotHours: 2,
      })
    const orderId = orderRes.body.data.id

    // User B tries to view User A's order -> 403
    const detailsRes = await request(app).get(`/api/v1/orders/${orderId}`).set('Cookie', userB.cookie)
    assert.equal(detailsRes.status, 403)
    assert.equal(detailsRes.body.error.code, 'FORBIDDEN')

    // User B tries to view User A's tracking -> 403
    const trackingRes = await request(app).get(`/api/v1/orders/${orderId}/tracking`).set('Cookie', userB.cookie)
    assert.equal(trackingRes.status, 403)
    assert.equal(trackingRes.body.error.code, 'FORBIDDEN')
  })
})
