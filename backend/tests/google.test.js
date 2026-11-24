import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { config } from '../src/config/env.js'
import { googleVerifier } from '../src/services/google.service.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { User } from '../src/models/User.js'

// Fake Google: the "credential" is just the email, and these are the accounts Google "knows".
const GOOGLE_ACCOUNTS = {
  'new.person@gmail.com': { sub: 'g-new-1', email: 'new.person@gmail.com', email_verified: true, name: 'New Person' },
  'existing@gmail.com': { sub: 'g-existing-1', email: 'existing@gmail.com', email_verified: true, name: 'Existing User' },
  'unverified@gmail.com': { sub: 'g-unverified', email: 'unverified@gmail.com', email_verified: false, name: 'No Verify' },
}
const credentialFor = (email) => `fake-google-id-token::${email}`

describe('Sign in with Google', () => {
  let server
  let baseUrl
  let realVerify
  let realClientId

  before(async () => {
    await setupTestDb()
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
    realClientId = config.GOOGLE_CLIENT_ID
    config.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
    realVerify = googleVerifier.verifyIdToken
    googleVerifier.verifyIdToken = async (idToken, audience) => {
      assert.equal(audience, config.GOOGLE_CLIENT_ID)
      const account = GOOGLE_ACCOUNTS[idToken.split('::')[1]]
      if (!account) throw new Error('Invalid token signature')
      return account
    }
  })

  after(async () => {
    googleVerifier.verifyIdToken = realVerify
    config.GOOGLE_CLIENT_ID = realClientId
    server.close()
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  const post = (body) =>
    fetch(`${baseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': 'true' },
      body: JSON.stringify(body),
    })

  test('a new person is asked for their phone number first, and nothing is saved yet', async () => {
    const res = await post({ credential: credentialFor('new.person@gmail.com') })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.data.needsPhone, true)
    assert.equal(body.data.user, null)
    assert.deepEqual(body.data.profile, { fullName: 'New Person', email: 'new.person@gmail.com' })
    assert.ok(!res.headers.getSetCookie().some((c) => c.startsWith('wise_session=')), 'must not sign in yet')
    assert.equal(await User.countDocuments(), 0)
  })

  test('with a phone number, a new customer is created, email verified, and signed in', async () => {
    const res = await post({ credential: credentialFor('new.person@gmail.com'), phone: '9876501234' })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.data.needsPhone, false)
    assert.equal(body.data.user.email, 'new.person@gmail.com')
    assert.equal(body.data.user.isEmailVerified, true)
    assert.equal(body.data.user.googleId, undefined, 'googleId must not be sent to the browser')
    assert.equal(body.data.user.passwordHash, undefined)
    const sessionCookie = res.headers.getSetCookie().find((c) => c.startsWith('wise_session='))
    assert.ok(sessionCookie, 'session cookie is set')

    const saved = await User.findOne({ email: 'new.person@gmail.com' })
    assert.equal(saved.googleId, 'g-new-1')
    assert.equal(saved.phone, '9876501234')
    assert.equal(saved.passwordHash, undefined)

    // The session cookie works for /auth/me
    const cookie = sessionCookie.split(';')[0]
    const me = await fetch(`${baseUrl}/auth/me`, { headers: { Cookie: cookie } })
    assert.equal(me.status, 200)
  })

  test('the same Google account signs straight in next time', async () => {
    await post({ credential: credentialFor('new.person@gmail.com'), phone: '9876501234' })
    const res = await post({ credential: credentialFor('new.person@gmail.com') })
    const body = await res.json()
    assert.equal(body.data.needsPhone, false)
    assert.equal(body.data.user.phone, '9876501234')
    assert.equal(await User.countDocuments(), 1)
  })

  test('an existing email-and-password account is linked to Google and keeps its password', async () => {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': 'true' },
      body: JSON.stringify({ fullName: 'Existing User', email: 'existing@gmail.com', phone: '9876500000', password: 'Str0ngPass!word' }),
    })
    assert.equal(reg.status, 201)

    const res = await post({ credential: credentialFor('existing@gmail.com') })
    const body = await res.json()
    assert.equal(body.data.needsPhone, false)
    assert.equal(body.data.user.isEmailVerified, true)
    assert.equal(await User.countDocuments(), 1)

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': 'true' },
      body: JSON.stringify({ email: 'existing@gmail.com', password: 'Str0ngPass!word' }),
    })
    assert.equal(login.status, 200)
  })

  test('a Google-only account cannot log in with an email and a guessed password', async () => {
    await post({ credential: credentialFor('new.person@gmail.com'), phone: '9876501234' })
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': 'true' },
      body: JSON.stringify({ email: 'new.person@gmail.com', password: 'anything123' }),
    })
    assert.equal(login.status, 400)
  })

  test('a fake or tampered credential is rejected', async () => {
    const res = await post({ credential: 'fake-google-id-token::attacker@evil.com' })
    assert.equal(res.status, 401)
    assert.equal(await User.countDocuments(), 0)
  })

  test('a Client ID mismatch says so clearly', async () => {
    const real = googleVerifier.verifyIdToken
    googleVerifier.verifyIdToken = async () => {
      throw new Error('Wrong recipient, payload audience != requiredAudience')
    }
    const res = await post({ credential: credentialFor('new.person@gmail.com') })
    googleVerifier.verifyIdToken = real
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error.code, 'GOOGLE_CLIENT_ID_MISMATCH')
  })

  test('a Google account without a verified email is rejected', async () => {
    const res = await post({ credential: credentialFor('unverified@gmail.com'), phone: '9876501234' })
    assert.equal(res.status, 400)
    assert.equal(await User.countDocuments(), 0)
  })

  test('a bad phone number is rejected', async () => {
    const res = await post({ credential: credentialFor('new.person@gmail.com'), phone: '12345' })
    assert.equal(res.status, 400)
    assert.equal(await User.countDocuments(), 0)
  })

  test('when Google sign-in is not set up, it says so clearly', async () => {
    config.GOOGLE_CLIENT_ID = ''
    const res = await post({ credential: credentialFor('new.person@gmail.com') })
    config.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'GOOGLE_NOT_CONFIGURED')
  })
})
