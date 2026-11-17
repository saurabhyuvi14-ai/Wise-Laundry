import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { User } from '../src/models/User.js'
import { Session } from '../src/models/Session.js'

describe('Authentication & User Management', () => {
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

  test('registers a customer with Argon2id hashing and HttpOnly session cookie', async () => {
    const payload = {
      fullName: 'Saurabh Sharma',
      email: 'saurabh@example.com',
      phone: '9876543210',
      password: 'StrongPassword123!',
    }

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify(payload),
    })

    assert.equal(res.status, 201)
    const json = await res.json()
    assert.equal(json.data.email, 'saurabh@example.com')
    assert.equal(json.data.fullName, 'Saurabh Sharma')
    assert.equal(json.data.role, 'CUSTOMER')
    assert.equal(json.data.passwordHash, undefined)

    // Verify session cookie was set
    const setCookie = res.headers.get('set-cookie')
    assert.ok(setCookie && setCookie.includes('wise_session='))
    assert.ok(setCookie.includes('HttpOnly'))

    // Verify database record has valid Argon2id hash
    const userInDb = await User.findOne({ email: 'saurabh@example.com' })
    assert.ok(userInDb)
    assert.ok(userInDb.passwordHash.startsWith('$argon2id$'))
    assert.equal(await userInDb.verifyPassword('StrongPassword123!'), true)
  })

  test('rejects role injection attempts during registration', async () => {
    const payload = {
      fullName: 'Malicious User',
      email: 'hacker@example.com',
      phone: '9876543211',
      password: 'StrongPassword123!',
      role: 'ADMIN', // Injection attempt
    }

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify(payload),
    })

    assert.equal(res.status, 400)
    const json = await res.json()
    assert.equal(json.error.code, 'VALIDATION_ERROR')
  })

  test('logs in successfully and fails on incorrect password', async () => {
    // 1. Create a user
    const passwordHash = await User.hashPassword('Secret123!')
    await User.create({
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '9876543212',
      passwordHash,
      role: 'CUSTOMER',
    })

    // 2. Attempt login with bad password
    const badRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ email: 'test@example.com', password: 'WrongPassword' }),
    })
    assert.equal(badRes.status, 400)

    // 3. Attempt login with correct password
    const goodRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ email: 'test@example.com', password: 'Secret123!' }),
    })
    assert.equal(goodRes.status, 200)
    const setCookie = goodRes.headers.get('set-cookie')
    assert.ok(setCookie && setCookie.includes('wise_session='))
  })

  test('fetches current profile with /auth/me and updates with /users/me', async () => {
    // Register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        fullName: 'Profile User',
        email: 'profile@example.com',
        phone: '9876543213',
        password: 'Password123!',
      }),
    })
    const cookieHeader = regRes.headers.get('set-cookie')
    const sessionCookie = cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]

    // Fetch /auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: sessionCookie },
    })
    assert.equal(meRes.status, 200)
    const meJson = await meRes.json()
    assert.equal(meJson.data.fullName, 'Profile User')

    // Update /users/me
    const updateRes = await fetch(`${baseUrl}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie,
        'x-test-bypass-csrf': '1',
      },
      body: JSON.stringify({ fullName: 'Updated Name', phone: '9876543214' }),
    })
    assert.equal(updateRes.status, 200)
    const updatedJson = await updateRes.json()
    assert.equal(updatedJson.data.fullName, 'Updated Name')
    assert.equal(updatedJson.data.phone, '9876543214')
  })

  test('revokes server-side session on logout', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        fullName: 'Logout User',
        email: 'logout@example.com',
        phone: '9876543215',
        password: 'Password123!',
      }),
    })
    const cookieHeader = regRes.headers.get('set-cookie')
    const sessionCookie = cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]

    // Confirm session is valid
    const meBefore = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: sessionCookie } })
    assert.equal(meBefore.status, 200)

    // Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { cookie: sessionCookie, 'x-test-bypass-csrf': '1' },
    })
    assert.equal(logoutRes.status, 204)

    // Attempt /auth/me again -> should be 401
    const meAfter = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: sessionCookie } })
    assert.equal(meAfter.status, 401)
  })

  test('handles forgot-password and reset-password with session revocation', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        fullName: 'Reset User',
        email: 'reset@example.com',
        phone: '9876543216',
        password: 'OldPassword123!',
      }),
    })
    const cookieHeader = regRes.headers.get('set-cookie')
    const sessionCookie = cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]

    // Request reset token
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ email: 'reset@example.com' }),
    })
    assert.equal(forgotRes.status, 200)
    const forgotJson = await forgotRes.json()
    const token = forgotJson.meta.resetTokenNotice
    assert.ok(token)

    // Reset password
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ token, newPassword: 'BrandNewPassword123!' }),
    })
    assert.equal(resetRes.status, 200)

    // Old session should be revoked
    const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: sessionCookie } })
    assert.equal(meRes.status, 401)

    // New login works with new password
    const newLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({ email: 'reset@example.com', password: 'BrandNewPassword123!' }),
    })
    assert.equal(newLogin.status, 200)
  })
})
