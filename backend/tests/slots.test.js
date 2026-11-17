import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { SlotCapacity } from '../src/models/SlotCapacity.js'
import { reserveSlot } from '../src/services/slot.service.js'

describe('Slot Capacity & Competing Slot Requests', () => {
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

  test('atomically reserves slots up to maximum capacity and rejects overbooking', async () => {
    const testDate = '2026-12-01'
    const testHour = 10
    const maxCapacity = 3

    // 1. Reserve 3 slots successfully
    await SlotCapacity.reserveSlot(testDate, testHour, maxCapacity)
    await SlotCapacity.reserveSlot(testDate, testHour, maxCapacity)
    const slot3 = await SlotCapacity.reserveSlot(testDate, testHour, maxCapacity)
    assert.equal(slot3.bookedCount, 3)

    // 2. 4th reservation must throw conflict
    await assert.rejects(
      async () => {
        await SlotCapacity.reserveSlot(testDate, testHour, maxCapacity)
      },
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'CONFLICT')
        return true
      },
    )

    // 3. Release one slot and verify another reservation succeeds
    await SlotCapacity.releaseSlot(testDate, testHour)
    const slotAfterRelease = await SlotCapacity.reserveSlot(testDate, testHour, maxCapacity)
    assert.equal(slotAfterRelease.bookedCount, 3)
  })

  test('handles competing simultaneous requests safely without over-allocating', async () => {
    const testDate = '2026-12-02'
    const testHour = 14
    const maxCapacity = 5
    const totalRequests = 15

    // Fire 15 simultaneous booking attempts
    const results = await Promise.allSettled(
      Array.from({ length: totalRequests }).map(() =>
        SlotCapacity.reserveSlot(testDate, testHour, maxCapacity),
      ),
    )

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    // Exactly 5 reservations must succeed, remaining 10 must be safely rejected
    assert.equal(fulfilled.length, maxCapacity)
    assert.equal(rejected.length, totalRequests - maxCapacity)

    // Verify final state in database
    const slotDoc = await SlotCapacity.findOne({ slotKey: `${testDate}_${testHour}` })
    assert.equal(slotDoc.bookedCount, maxCapacity)
  })
})
