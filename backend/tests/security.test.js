import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb } from './helpers/testDb.js'

describe('Security, CSRF, Cache Controls & Health', () => {
  before(async () => {
    await setupTestDb()
  })

  after(async () => {
    await teardownTestDb()
  })

  it('rejects mutative requests from unapproved foreign Origin (CSRF protection)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://malicious-phishing-site.com')
      .send({
        email: 'attacker@example.com',
        password: 'Password@123',
      })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'FORBIDDEN')
    assert.ok(res.body.error.message.includes('Cross-Site Request Blocked'))
  })

  it('sets private no-cache headers on protected endpoints', async () => {
    // Register to get cookie
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-bypass-csrf', '1')
      .send({
        fullName: 'Cache Test User',
        email: 'cache@example.com',
        phone: '9876543216',
        password: 'Password@123',
      })

    const cookie = reg.headers['set-cookie']
    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', cookie)

    assert.equal(meRes.status, 200)
    assert.ok(meRes.headers['cache-control'].includes('no-store'))
    assert.ok(meRes.headers['cache-control'].includes('private'))
  })

  it('returns healthy status and database connection state on /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'healthy')
    assert.equal(res.body.services.database, 'connected')
    assert.equal(res.body.services.api, 'up')
  })
})
