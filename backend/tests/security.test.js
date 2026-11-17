import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb } from './helpers/testDb.js'

describe('Security, CSRF, Cache Controls & Health', () => {
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

  test('rejects mutative requests from unapproved foreign Origin (CSRF protection)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil-phishing-site.com', // Unauthorized origin
      },
      body: JSON.stringify({
        fullName: 'Phishing Victim',
        email: 'victim@example.com',
        phone: '9876543210',
        password: 'Password123!',
      }),
    })

    assert.equal(res.status, 403)
    const json = await res.json()
    assert.equal(json.error.code, 'FORBIDDEN')
  })

  test('sets private no-cache headers on protected endpoints', async () => {
    // Register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' },
      body: JSON.stringify({
        fullName: 'Security User',
        email: 'sec@example.com',
        phone: '9876543210',
        password: 'Password123!',
      }),
    })
    const cookieHeader = regRes.headers.get('set-cookie')
    const sessionCookie = cookieHeader.split(',').find((c) => c.includes('wise_session=')).split(';')[0]

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: sessionCookie },
    })

    assert.equal(meRes.status, 200)
    const cacheControl = meRes.headers.get('cache-control')
    assert.ok(cacheControl)
    assert.ok(cacheControl.includes('no-store'))
    assert.ok(cacheControl.includes('private'))
  })

  test('returns healthy status and database connection state on /api/v1/health', async () => {
    const res = await fetch(`${baseUrl}/health`)
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.status, 'healthy')
    assert.equal(json.database.ready, true)
    assert.equal(json.database.state, 'connected')
    assert.ok(json.timestamp)
  })
})

