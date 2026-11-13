import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb.js'
import { SlotCapacity } from '../src/models/SlotCapacity.js'
import { ApiError } from '../src/utils/errors.js'

describe('Slot Capacity & Competing Slot Requests', () => {
  before(async () => {
    await setupTestDb()
  })

  after(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  it('atomically reserves slots up to maximum capacity and rejects overbooking', async () => {
    const testDate = '2026-11-20'
    const slotHour = 10
    const maxCapacity = 3

    // First 3 reservations must succeed
    const r1 = await SlotCapacity.reserveSlot(testDate, slotHour, maxCapacity)
    assert.equal(r1.bookedCount, 1)

    const r2 = await SlotCapacity.reserveSlot(testDate, slotHour, maxCapacity)
    assert.equal(r2.bookedCount, 2)

    const r3 = await SlotCapacity.reserveSlot(testDate, slotHour, maxCapacity)
    assert.equal(r3.bookedCount, 3)

    // 4th reservation must fail with 409 conflict
    await assert.rejects(
      async () => {
        await SlotCapacity.reserveSlot(testDate, slotHour, maxCapacity)
      },
      (err) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.status, 409)
        assert.equal(err.code, 'CONFLICT')
        return true
      },
    )

    // Slot availability check confirms 0 available and isFull = true
    const avail = await SlotCapacity.getSlotAvailability(testDate, slotHour, maxCapacity)
    assert.equal(avail.booked, 3)
    assert.equal(avail.available, 0)
    assert.equal(avail.isFull, true)
  })

  it('handles competing simultaneous requests safely without over-allocating', async () => {
    const testDate = '2026-11-21'
    const slotHour = 14
    const maxCapacity = 5

    // Simulate 10 simultaneous competing slot requests
    const attempts = Array.from({ length: 10 }, () =>
      SlotCapacity.reserveSlot(testDate, slotHour, maxCapacity)
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, err })),
    )

    const results = await Promise.all(attempts)
    const successes = results.filter((r) => r.success).length
    const failures = results.filter((r) => !r.success).length

    // Exactly 5 must succeed and exactly 5 must fail
    assert.equal(successes, 5)
    assert.equal(failures, 5)

    const doc = await SlotCapacity.findOne({ slotKey: `${testDate}_${slotHour}` })
    assert.equal(doc.bookedCount, 5)
  })
})
