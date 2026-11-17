import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Address } from '../src/models/Address.js'

describe('Address Management & Field Encryption', () => {
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
        fullName: 'Test User',
        email,
        phone: '9876543210',
        password: 'Password123!',
      }),
    })
    const cookieHeader = res.headers.get('set-cookie')
    return cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]
  }

  test('creates an address, encrypts sensitive lines at rest, and decrypts on read', async () => {
    const cookie = await registerAndGetCookie('user_addr@example.com')

    const payload = {
      label: 'HOME',
      recipientName: 'Saurabh Sharma',
      phone: '9876543210',
      addressLine1: 'Flat 402, Green Glen Residency',
      addressLine2: 'Outer Ring Road, Bellandur',
      city: 'Bengaluru',
      postalCode: '560103',
      landmark: 'Near Central Mall',
      instructions: 'Leave at security desk',
      isDefault: true,
    }

    const res = await fetch(`${baseUrl}/addresses`, {
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
    assert.equal(json.data.addressLine1, 'Flat 402, Green Glen Residency')
    assert.equal(json.data.instructions, 'Leave at security desk')
    assert.equal(json.data.isDefault, true)

    // Direct Database Inspection: verify fields are encrypted at rest with AES-256-GCM v1 prefix
    const rawDoc = await Address.findById(json.data.id).lean()
    assert.ok(rawDoc.addressLine1Encrypted.startsWith('v1:'))
    assert.ok(rawDoc.addressLine2Encrypted.startsWith('v1:'))
    assert.ok(rawDoc.instructionsEncrypted.startsWith('v1:'))
    assert.equal(rawDoc.addressLine1, undefined) // Plaintext field should not exist in DB

    // GET /addresses: verify transparent decryption
    const listRes = await fetch(`${baseUrl}/addresses`, {
      headers: { cookie },
    })
    assert.equal(listRes.status, 200)
    const listJson = await listRes.json()
    assert.equal(listJson.data.length, 1)
    assert.equal(listJson.data[0].addressLine1, 'Flat 402, Green Glen Residency')
  })

  test('enforces cross-account isolation: User B cannot read, update or delete User A address', async () => {
    const userACookie = await registerAndGetCookie('user_a@example.com')
    const userBCookie = await registerAndGetCookie('user_b@example.com')

    // User A creates an address
    const createRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userACookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        label: 'HOME',
        recipientName: 'User A',
        phone: '9876543210',
        addressLine1: 'User A Secret House',
        addressLine2: 'Road A',
        city: 'Bengaluru',
        postalCode: '560100',
      }),
    })
    const { data: addrA } = await createRes.json()

    // User B tries to update User A address
    const patchRes = await fetch(`${baseUrl}/addresses/${addrA.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: userBCookie, 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ addressLine1: 'Hacked address' }),
    })
    assert.equal(patchRes.status, 403)

    // User B tries to delete User A address
    const deleteRes = await fetch(`${baseUrl}/addresses/${addrA.id}`, {
      method: 'DELETE',
      headers: { cookie: userBCookie, 'x-test-bypass-csrf': '1' },
    })
    assert.equal(deleteRes.status, 403)

    // User B lists addresses -> empty list
    const listBRes = await fetch(`${baseUrl}/addresses`, { headers: { cookie: userBCookie } })
    const listBJson = await listBRes.json()
    assert.equal(listBJson.data.length, 0)
  })
})
