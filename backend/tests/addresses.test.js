import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb.js'
import { Address } from '../src/models/Address.js'

describe('Address Management & Field Encryption', () => {
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

  it('creates an address, encrypts sensitive lines at rest, and decrypts on read', async () => {
    const { cookie } = await createRegisteredUser('User One', 'user1@example.com')

    const createRes = await request(app)
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
      .send({
        label: 'HOME',
        recipientName: 'User One',
        phone: '9876543210',
        addressLine1: 'Flat 402, Sunshine Towers',
        addressLine2: '12th Main, Koramangala 4th Block',
        landmark: 'Opposite BDA Complex',
        city: 'Bengaluru',
        postalCode: '560034',
        instructions: 'Ring doorbell twice.',
        isDefault: true,
      })

    assert.equal(createRes.status, 201)
    const addressId = createRes.body.data.id
    assert.equal(createRes.body.data.addressLine1, 'Flat 402, Sunshine Towers')
    assert.equal(createRes.body.data.instructions, 'Ring doorbell twice.')

    // Verify raw DB document is encrypted at rest
    const rawDoc = await Address.findById(addressId)
    assert.ok(rawDoc)
    assert.ok(rawDoc.addressLine1Encrypted.startsWith('v1:'))
    assert.ok(!rawDoc.addressLine1Encrypted.includes('Sunshine Towers'))
    assert.ok(rawDoc.instructionsEncrypted.startsWith('v1:'))
    assert.ok(!rawDoc.instructionsEncrypted.includes('doorbell'))

    // Verify GET /api/v1/addresses returns decrypted data
    const listRes = await request(app).get('/api/v1/addresses').set('Cookie', cookie)
    assert.equal(listRes.status, 200)
    assert.equal(listRes.body.data.length, 1)
    assert.equal(listRes.body.data[0].addressLine1, 'Flat 402, Sunshine Towers')
    assert.equal(listRes.body.data[0].isDefault, true)
  })

  it('enforces cross-account isolation: User B cannot read, update or delete User A address', async () => {
    const userA = await createRegisteredUser('User A', 'usera@example.com')
    const userB = await createRegisteredUser('User B', 'userb@example.com')

    // User A creates an address
    const aRes = await request(app)
      .post('/api/v1/addresses')
      .set('Cookie', userA.cookie)
      .set('x-test-bypass-csrf', '1')
      .send({
        label: 'WORK',
        recipientName: 'User A',
        phone: '9876543210',
        addressLine1: 'Tech Park Tower 1',
        addressLine2: 'Outer Ring Road',
        city: 'Bengaluru',
        postalCode: '560103',
        isDefault: true,
      })
    const addressAId = aRes.body.data.id

    // User B tries to update User A's address -> 403 Forbidden
    const patchRes = await request(app)
      .patch(`/api/v1/addresses/${addressAId}`)
      .set('Cookie', userB.cookie)
      .set('x-test-bypass-csrf', '1')
      .send({ recipientName: 'Malicious Overwrite' })

    assert.equal(patchRes.status, 403)
    assert.equal(patchRes.body.error.code, 'FORBIDDEN')

    // User B tries to delete User A's address -> 403 Forbidden
    const deleteRes = await request(app)
      .delete(`/api/v1/addresses/${addressAId}`)
      .set('Cookie', userB.cookie)
      .set('x-test-bypass-csrf', '1')

    assert.equal(deleteRes.status, 403)
    assert.equal(deleteRes.body.error.code, 'FORBIDDEN')

    // User B's address list does NOT contain User A's address
    const bList = await request(app).get('/api/v1/addresses').set('Cookie', userB.cookie)
    assert.equal(bList.status, 200)
    assert.equal(bList.body.data.length, 0)
  })
})
