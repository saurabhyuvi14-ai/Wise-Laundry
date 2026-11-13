import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb.js'
import { User } from '../src/models/User.js'

describe('Authentication & User Management', () => {
  before(async () => {
    await setupTestDb()
  })

  after(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  it('registers a customer with Argon2id hashing and HttpOnly session cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Aarav Mehta',
        email: 'aarav@example.com',
        phone: '9876543210',
        password: 'Password@123',
      })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.email, 'aarav@example.com')
    assert.equal(res.body.data.role, 'CUSTOMER')
    assert.equal(res.body.data.fullName, 'Aarav Mehta')
    assert.ok(res.body.data.id)

    // Check cookie
    const cookies = res.headers['set-cookie'] || []
    const sessionCookie = cookies.find((c) => c.includes('wise_session='))
    assert.ok(sessionCookie)
    assert.ok(sessionCookie.includes('HttpOnly'))

    // Verify DB entry has Argon2id hash
    const userInDb = await User.findOne({ email: 'aarav@example.com' })
    assert.ok(userInDb)
    assert.ok(userInDb.passwordHash.startsWith('$argon2id$'))
  })

  it('rejects role injection attempts during registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Hacker User',
        email: 'hacker@example.com',
        phone: '9876543211',
        password: 'Password@123',
        role: 'ADMIN', // injection attempt
      })

    // Schema strictly validates undefined role
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'VALIDATION_ERROR')
  })

  it('logs in successfully and fails on incorrect password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Priya Sharma',
        email: 'priya@example.com',
        phone: '9876543212',
        password: 'CorrectPassword123',
      })

    // Correct login
    const loginOk = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-bypass-csrf', '1')
      .send({
        email: 'priya@example.com',
        password: 'CorrectPassword123',
      })
    assert.equal(loginOk.status, 200)
    assert.equal(loginOk.body.data.email, 'priya@example.com')
    assert.ok(loginOk.headers['set-cookie'])

    // Wrong password
    const loginFail = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-bypass-csrf', '1')
      .send({
        email: 'priya@example.com',
        password: 'WrongPassword123',
      })
    assert.equal(loginFail.status, 400)
    assert.equal(loginFail.body.error.code, 'VALIDATION_ERROR')
  })

  it('fetches current profile with /auth/me and updates with /users/me', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Rohit Verma',
        email: 'rohit@example.com',
        phone: '9876543213',
        password: 'Password@123',
      })
    const cookie = reg.headers['set-cookie']

    // /auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
    assert.equal(meRes.status, 200)
    assert.equal(meRes.body.data.fullName, 'Rohit Verma')

    // /users/me PATCH
    const patchRes = await request(app)
      .patch('/api/v1/users/me')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Rohit K. Verma',
        phone: '9876543219',
      })
    assert.equal(patchRes.status, 200)
    assert.equal(patchRes.body.data.fullName, 'Rohit K. Verma')
    assert.equal(patchRes.body.data.phone, '9876543219')
  })

  it('revokes server-side session on logout', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Sneha Patel',
        email: 'sneha@example.com',
        phone: '9876543214',
        password: 'Password@123',
      })
    const cookie = reg.headers['set-cookie']

    // Verify authenticated
    const before = await request(app).get('/api/v1/auth/me').set('Cookie', cookie)
    assert.equal(before.status, 200)

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('x-test-bypass-csrf', '1')
    assert.equal(logoutRes.status, 204)

    // After logout, session is revoked
    const after = await request(app).get('/api/v1/auth/me').set('Cookie', cookie)
    assert.equal(after.status, 401)
    assert.equal(after.body.error.code, 'UNAUTHENTICATED')
  })

  it('handles forgot-password and reset-password with session revocation', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Vikram Singh',
        email: 'vikram@example.com',
        phone: '9876543215',
        password: 'OldPassword@123',
      })
    const oldCookie = reg.headers['set-cookie']

    // Request password reset
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('x-test-bypass-csrf', '1')
      .send({ email: 'vikram@example.com' })
    assert.equal(forgotRes.status, 200)
    const resetToken = forgotRes.body.meta?.resetTokenNotice
    assert.ok(resetToken)

    // Complete password reset
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('x-test-bypass-csrf', '1')
      .send({
        token: resetToken,
        newPassword: 'NewPassword@123',
      })
    assert.equal(resetRes.status, 200)

    // Old session must now be revoked
    const oldSessionCheck = await request(app).get('/api/v1/auth/me').set('Cookie', oldCookie)
    assert.equal(oldSessionCheck.status, 401)

    // New login with new password succeeds
    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-bypass-csrf', '1')
      .send({
        email: 'vikram@example.com',
        password: 'NewPassword@123',
      })
    assert.equal(newLogin.status, 200)
  })
})
