import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Order } from '../src/models/Order.js'
import { SlotCapacity } from '../src/models/SlotCapacity.js'
import { config } from '../src/config/env.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// A slot start at a whole UTC hour, `hoursAhead` from now.
const slotIn = (hoursAhead) => {
  const d = new Date(Date.now() + hoursAhead * HOUR)
  d.setUTCMinutes(0, 0, 0)
  return d
}
const slotKey = (d) => `${d.toISOString().split('T')[0]}_${d.getUTCHours()}`

describe('Cancel and reschedule', () => {
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
  const post = (cookie, path, body) =>
    fetch(`${baseUrl}${path}`, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body) })

  async function customer(email) {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ fullName: 'Change Tester', email, phone: '9876543210', password: 'Password123!' }),
    })
    const cookie = reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
    const addr = await post(cookie, '/addresses', {
      label: 'HOME', recipientName: 'Change Tester', phone: '9876543210',
      addressLine1: 'Villa 12, Palm Meadows', addressLine2: 'Whitefield', city: 'Bengaluru', postalCode: '560066',
    })
    const { data: address } = await addr.json()
    return { cookie, address }
  }

  async function book(cookie, address, when) {
    const res = await post(cookie, '/orders', {
      items: [{ serviceId: 'service_wash_fold' }], addressId: address.id, pickupScheduledAt: when.toISOString(), pickupSlotHours: 2,
    })
    assert.equal(res.status, 201)
    return (await res.json()).data
  }

  test('a new order shows what the customer can change and until when', async () => {
    const { cookie, address } = await customer('rules@example.com')
    const when = slotIn(24)
    const order = await book(cookie, address, when)
    assert.equal(order.changeRules.canCancel, true)
    assert.equal(order.changeRules.canReschedule, true)
    assert.equal(order.changeRules.reschedulesLeft, 2)
    assert.equal(new Date(order.changeRules.changeDeadline).getTime(), when.getTime() - 2 * HOUR)
  })

  test('cancel works before the deadline, saves the reason, and frees the slot', async () => {
    const { cookie, address } = await customer('cancel@example.com')
    const when = slotIn(24)
    const order = await book(cookie, address, when)
    assert.equal((await SlotCapacity.findOne({ slotKey: slotKey(when) })).bookedCount, 1)

    const res = await post(cookie, `/orders/${order.id}/cancel`, { reason: 'CHANGE_OF_PLANS', note: 'Travelling' })
    assert.equal(res.status, 200)
    const { data } = await res.json()
    assert.equal(data.currentStatus, 'CANCELLED')
    assert.equal(data.cancellation.reason, 'CHANGE_OF_PLANS')
    assert.equal(data.cancellation.cancelledBy, 'CUSTOMER')
    assert.equal(data.changeRules.canCancel, false)
    assert.equal(data.statusHistory.at(-1).status, 'CANCELLED')
    assert.equal((await SlotCapacity.findOne({ slotKey: slotKey(when) })).bookedCount, 0)
  })

  test('pressing cancel twice is harmless and does not free the slot twice', async () => {
    const { cookie, address } = await customer('twice@example.com')
    const when = slotIn(24)
    const a = await book(cookie, address, when)
    // Someone else books the same slot
    const other = await customer('other@example.com')
    await book(other.cookie, other.address, when)

    assert.equal((await post(cookie, `/orders/${a.id}/cancel`, { reason: 'OTHER' })).status, 200)
    assert.equal((await post(cookie, `/orders/${a.id}/cancel`, { reason: 'OTHER' })).status, 200)
    assert.equal((await SlotCapacity.findOne({ slotKey: slotKey(when) })).bookedCount, 1)
  })

  test('cancel is refused inside the 2-hour window', async () => {
    const { cookie, address } = await customer('late@example.com')
    const order = await book(cookie, address, slotIn(24))
    await Order.updateOne({ orderIdString: order.id }, { $set: { pickupScheduledAt: new Date(Date.now() + HOUR) } })

    const res = await post(cookie, `/orders/${order.id}/cancel`, { reason: 'CHANGE_OF_PLANS' })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ORDER_CHANGE_TOO_LATE')
    assert.equal((await Order.findOne({ orderIdString: order.id })).currentStatus, 'BOOKED')
  })

  test('cancel is refused once the clothes are picked up', async () => {
    const { cookie, address } = await customer('picked@example.com')
    const order = await book(cookie, address, slotIn(24))
    await Order.updateOne({ orderIdString: order.id }, { $set: { currentStatus: 'PICKED_UP' } })

    const res = await post(cookie, `/orders/${order.id}/cancel`, { reason: 'CHANGE_OF_PLANS' })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ORDER_ALREADY_PICKED_UP')
  })

  test('cancel needs a valid reason', async () => {
    const { cookie, address } = await customer('reason@example.com')
    const order = await book(cookie, address, slotIn(24))
    const res = await post(cookie, `/orders/${order.id}/cancel`, { reason: 'NOPE' })
    assert.equal(res.status, 400)
  })

  test("someone else's order can't be cancelled or rescheduled", async () => {
    const owner = await customer('owner@example.com')
    const order = await book(owner.cookie, owner.address, slotIn(24))
    const stranger = await customer('stranger@example.com')
    assert.equal((await post(stranger.cookie, `/orders/${order.id}/cancel`, { reason: 'OTHER' })).status, 403)
    assert.equal((await post(stranger.cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: slotIn(48).toISOString() })).status, 403)
  })

  test('reschedule moves the pickup, frees the old slot, takes the new one, and keeps history', async () => {
    const { cookie, address } = await customer('move@example.com')
    const oldWhen = slotIn(24)
    const newWhen = slotIn(48)
    const order = await book(cookie, address, oldWhen)

    const res = await post(cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: newWhen.toISOString() })
    assert.equal(res.status, 200)
    const { data } = await res.json()
    assert.equal(data.pickupScheduledAt, newWhen.toISOString())
    assert.equal(data.rescheduleCount, 1)
    assert.equal(data.changeRules.reschedulesLeft, 1)
    assert.equal(data.scheduleHistory.length, 1)
    assert.equal(data.scheduleHistory[0].from, oldWhen.toISOString())
    assert.equal((await SlotCapacity.findOne({ slotKey: slotKey(oldWhen) })).bookedCount, 0)
    assert.equal((await SlotCapacity.findOne({ slotKey: slotKey(newWhen) })).bookedCount, 1)
  })

  test('reschedule stops after 2 times', async () => {
    const { cookie, address } = await customer('limit@example.com')
    const order = await book(cookie, address, slotIn(24))
    assert.equal((await post(cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: slotIn(30).toISOString() })).status, 200)
    assert.equal((await post(cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: slotIn(36).toISOString() })).status, 200)
    const third = await post(cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: slotIn(42).toISOString() })
    assert.equal(third.status, 409)
    assert.equal((await third.json()).error.code, 'RESCHEDULE_LIMIT_REACHED')
    // Cancelling is still allowed
    assert.equal((await post(cookie, `/orders/${order.id}/cancel`, { reason: 'OTHER' })).status, 200)
  })

  test('reschedule refuses a slot that is too soon, too far, the same, or full', async () => {
    const { cookie, address } = await customer('bad@example.com')
    const when = slotIn(24)
    const order = await book(cookie, address, when)
    const tryMove = (d) => post(cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: d.toISOString() })

    assert.equal((await tryMove(slotIn(1))).status, 400) // too soon
    assert.equal((await tryMove(new Date(Date.now() + 9 * DAY))).status, 400) // too far
    assert.equal((await tryMove(when)).status, 400) // same slot

    const full = slotIn(50)
    await SlotCapacity.create({ slotKey: slotKey(full), date: full.toISOString().split('T')[0], slotHour: full.getUTCHours(), bookedCount: config.DEFAULT_SLOT_CAPACITY, maxCapacity: config.DEFAULT_SLOT_CAPACITY })
    assert.equal((await tryMove(full)).status, 409) // full

    const saved = await Order.findOne({ orderIdString: order.id })
    assert.equal(saved.pickupScheduledAt.getTime(), when.getTime())
    assert.equal(saved.rescheduleCount, 0)
  })

  test('reschedule is refused inside the 2-hour window, and the new slot is not left taken', async () => {
    const { cookie, address } = await customer('lateMove@example.com')
    const order = await book(cookie, address, slotIn(24))
    await Order.updateOne({ orderIdString: order.id }, { $set: { pickupScheduledAt: new Date(Date.now() + HOUR) } })
    const target = slotIn(30)
    const res = await post(cookie, `/orders/${order.id}/reschedule`, { pickupScheduledAt: target.toISOString() })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ORDER_CHANGE_TOO_LATE')
    const slot = await SlotCapacity.findOne({ slotKey: slotKey(target) })
    assert.equal(slot ? slot.bookedCount : 0, 0)
  })
})
