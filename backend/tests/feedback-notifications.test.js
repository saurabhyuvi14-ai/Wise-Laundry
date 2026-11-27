import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'

const HOUR = 60 * 60 * 1000
const slotIn = (h) => { const d = new Date(Date.now() + h * HOUR); d.setUTCMinutes(0, 0, 0); return d }

describe('Ratings and updates feed', () => {
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

  async function customerWithOrder(email) {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName: 'Rating Tester', email, phone: '9876543210', password: 'Password123!' }),
    })
    const cookie = reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    const { data: address } = await (await post(cookie, '/addresses', {
      label: 'HOME', recipientName: 'Rating Tester', phone: '9876543210', addressLine1: 'Villa 3', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })).json()
    const res = await post(cookie, '/orders', { items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: slotIn(30).toISOString(), pickupSlotHours: 2 })
    return { cookie, order: (await res.json()).data }
  }

  const deliver = (ref) => Order.updateOne({ reference: ref }, {
    $set: { currentStatus: 'DELIVERED' },
    $push: { statusHistory: { $each: [{ status: 'PICKED_UP', changedAt: new Date(Date.now() + 1) }, { status: 'DELIVERED', changedAt: new Date(Date.now() + 2) }] } },
  })

  test('cannot rate before delivery', async () => {
    const { cookie, order } = await customerWithOrder('early@example.com')
    const res = await post(cookie, `/orders/${order.id}/feedback`, { rating: 5 })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ORDER_NOT_DELIVERED')
  })

  test('rate once after delivery, with a problem report', async () => {
    const { cookie, order } = await customerWithOrder('rate@example.com')
    await deliver(order.reference)
    const bad = await post(cookie, `/orders/${order.id}/feedback`, { rating: 0 })
    assert.equal(bad.status, 400)
    const res = await post(cookie, `/orders/${order.id}/feedback`, { rating: 2, tags: ['STAINS_LEFT'], comment: 'Collar still dirty', issue: { type: 'STAINS_LEFT', note: 'White shirt' } })
    assert.equal(res.status, 200)
    const { data } = await res.json()
    assert.equal(data.feedback.rating, 2)
    assert.deepEqual(data.feedback.tags, ['STAINS_LEFT'])
    assert.equal(data.feedback.issue.type, 'STAINS_LEFT')
    const again = await post(cookie, `/orders/${order.id}/feedback`, { rating: 5 })
    assert.equal(again.status, 409)
  })

  test('someone else cannot rate my order', async () => {
    const { order } = await customerWithOrder('owner@example.com')
    await deliver(order.reference)
    const other = await customerWithOrder('other@example.com')
    const res = await post(other.cookie, `/orders/${order.id}/feedback`, { rating: 1 })
    assert.equal(res.status, 403)
  })

  test('updates feed lists status changes and clears when seen', async () => {
    const { cookie, order } = await customerWithOrder('feed@example.com')
    await deliver(order.reference)
    let body = await (await get(cookie, '/notifications')).json()
    assert.equal(body.data[0].status, 'DELIVERED')
    assert.equal(body.data[0].reference, order.reference)
    assert.equal(body.meta.unreadCount, 3)
    await new Promise((r) => setTimeout(r, 20))
    assert.equal((await post(cookie, '/notifications/seen')).status, 200)
    body = await (await get(cookie, '/notifications')).json()
    assert.equal(body.meta.unreadCount, 0)
    assert.equal(body.data.length, 3)
  })
})
