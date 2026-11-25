import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { Session } from '../src/models/Session.js'

const DAY = 24 * 60 * 60 * 1000

describe('Staying logged in', () => {
  let server
  let baseUrl

  before(async () => {
    await setupTestDb()
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
  })
  after(async () => {
    server.close()
    await teardownTestDb()
  })
  beforeEach(async () => {
    await clearTestDb()
  })

  async function register() {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': 'true' },
      body: JSON.stringify({ fullName: 'Stay In', email: 'stay@wise.in', phone: '9876500011', password: 'Str0ngPass!word' }),
    })
    assert.equal(res.status, 201)
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('wise_session='))
    return { cookie: cookie.split(';')[0], header: cookie }
  }
  const me = (cookie) => fetch(`${baseUrl}/auth/me`, { headers: { Cookie: cookie } })

  test('a new login lasts 30 days', async () => {
    const { header } = await register()
    assert.match(header, /Max-Age=2592000/)
    const session = await Session.findOne()
    const days = (session.expiresAt - Date.now()) / DAY
    assert.ok(days > 29.9 && days <= 30, `expected ~30 days, got ${days}`)
  })

  test('using the site renews an older login back to 30 days', async () => {
    const { cookie } = await register()
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() + 3 * DAY) } })

    const res = await me(cookie)
    assert.equal(res.status, 200)
    assert.ok(res.headers.getSetCookie().some((c) => c.startsWith('wise_session=')), 'cookie refreshed')
    const days = ((await Session.findOne()).expiresAt - Date.now()) / DAY
    assert.ok(days > 29.9, `expected renewed to ~30 days, got ${days}`)
  })

  test('a login used today is not rewritten on every request', async () => {
    const { cookie } = await register()
    const before = (await Session.findOne()).expiresAt.getTime()
    const res = await me(cookie)
    assert.equal(res.status, 200)
    assert.ok(!res.headers.getSetCookie().some((c) => c.startsWith('wise_session=')))
    assert.equal((await Session.findOne()).expiresAt.getTime(), before)
  })

  test('an expired login is still refused', async () => {
    const { cookie } = await register()
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    const res = await me(cookie)
    assert.equal(res.status, 401)
  })
})
