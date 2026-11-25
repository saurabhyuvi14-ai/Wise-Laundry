import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Address } from '../src/models/Address.js'
import { Order } from '../src/models/Order.js'
import { checkServiceArea } from '../src/services/location.service.js'

describe('Location-Assisted Pickup Addresses & Service Area', () => {
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

  async function registerAndGetCookie(email) {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        fullName: 'Location Tester',
        email,
        phone: '9876543210',
        password: 'Password123!',
      }),
    })
    const cookieHeader = res.headers.get('set-cookie')
    return cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]
  }

  test('saves encrypted coordinates, accuracy, state and locationSource, and decrypts for owner only', async () => {
    const cookie = await registerAndGetCookie('loc_user@example.com')

    const res = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        label: 'HOME',
        recipientName: 'Location Tester',
        phone: '9876543210',
        addressLine1: 'Flat 201, Oak Residency',
        addressLine2: '24th Main, HSR Layout',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560102',
        coordinates: { lat: 12.9121, lng: 77.6446 },
        locationAccuracyMeters: 18,
        locationSource: 'GEOLOCATION',
      }),
    })

    assert.equal(res.status, 201)
    const json = await res.json()
    assert.deepEqual(json.data.coordinates, { lat: 12.9121, lng: 77.6446 })
    assert.equal(json.data.locationAccuracyMeters, 18)
    assert.equal(json.data.locationSource, 'GEOLOCATION')
    assert.equal(json.data.state, 'Karnataka')

    // Verify coordinates are encrypted at rest in MongoDB
    const rawDoc = await Address.findById(json.data.id).lean()
    assert.ok(rawDoc.coordinatesEncrypted.startsWith('v1:'))
    assert.equal(rawDoc.coordinates, undefined)
  })

  test('rejects unsupported pickup locations with "Outside our service area"', async () => {
    const cookie = await registerAndGetCookie('outside_user@example.com')

    // 1. Coordinates in Mumbai (outside Bengaluru service radius)
    const outsideRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        label: 'HOME',
        recipientName: 'Mumbai User',
        phone: '9876543210',
        addressLine1: '101 Marine Drive',
        addressLine2: 'Churchgate',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400020',
        coordinates: { lat: 18.9438, lng: 72.8231 },
        locationSource: 'GEOLOCATION',
      }),
    })

    assert.equal(outsideRes.status, 400)
    const outsideJson = await outsideRes.json()
    assert.equal(outsideJson.error.message, 'Outside our service area')

    // 2. Service-area helper returns supported=true for Bengaluru 560102
    const supported = checkServiceArea({
      coordinates: { lat: 12.9121, lng: 77.6446 },
      city: 'Bengaluru',
      postalCode: '560102',
    })
    assert.equal(supported.supported, true)
  })

  test('saves address-and-coordinate snapshot on each order so later address edits do not alter existing order', async () => {
    const cookie = await registerAndGetCookie('snapshot_user@example.com')

    // 1. Create address with initial coordinates
    const addrRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        label: 'HOME',
        recipientName: 'Snapshot User',
        phone: '9876543210',
        addressLine1: 'House 10, Green Avenue',
        addressLine2: 'Indiranagar 100ft Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        coordinates: { lat: 12.9784, lng: 77.6408 },
        locationAccuracyMeters: 12,
        locationSource: 'GEOLOCATION',
      }),
    })
    const { data: addr } = await addrRes.json()

    // 2. Book an order with this address
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        items: [{ serviceId: 'service_wash_fold' }],
        addressId: addr.id,
        pickupScheduledAt: futureDate,
      }),
    })
    assert.equal(orderRes.status, 201)
    const { data: order } = await orderRes.json()
    assert.deepEqual(order.addressSnapshot.coordinates, { lat: 12.9784, lng: 77.6408 })
    assert.equal(order.addressSnapshot.locationSource, 'GEOLOCATION')

    // Verify encrypted snapshot in MongoDB
    const rawOrder = await Order.findOne({ reference: order.reference }).lean()
    assert.ok(rawOrder.addressSnapshot.coordinatesEncrypted.startsWith('v1:'))

    // 3. Edit the saved address to a different Bengaluru location & clear coordinates
    const editRes = await fetch(`${baseUrl}/addresses/${addr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        addressLine1: 'New Flat 99',
        addressLine2: 'Koramangala 4th Block',
        postalCode: '560034',
        coordinates: null,
        locationSource: 'MANUAL',
      }),
    })
    assert.equal(editRes.status, 200)

    // 4. Re-fetch the existing order: snapshot must remain unchanged!
    const getOrderRes = await fetch(`${baseUrl}/orders/${order.id}`, {
      headers: { cookie },
    })
    assert.equal(getOrderRes.status, 200)
    const { data: unchangedOrder } = await getOrderRes.json()
    assert.equal(unchangedOrder.addressSnapshot.addressLine1, 'House 10, Green Avenue')
    assert.equal(unchangedOrder.addressSnapshot.postalCode, '560038')
    assert.deepEqual(unchangedOrder.addressSnapshot.coordinates, { lat: 12.9784, lng: 77.6408 })
  })

  test('requires authentication and validates coordinates on reverse-geocode endpoint', async () => {
    // Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/addresses/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ lat: 12.9716, lng: 77.5946 }),
    })
    assert.equal(unauthRes.status, 401)

    // Invalid coordinates -> 400
    const cookie = await registerAndGetCookie('geo_val@example.com')
    const badCoordsRes = await fetch(`${baseUrl}/addresses/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ lat: 250, lng: 77.5946 }),
    })
    assert.equal(badCoordsRes.status, 400)
  })
})
