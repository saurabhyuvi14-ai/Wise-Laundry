import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { config } from '../src/config/env.js'
import app from '../src/app.js'
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/testDb.js'
import { PushSubscription } from '../src/models/PushSubscription.js'
import { notifyUser } from '../src/services/push.service.js'
import { User } from '../src/models/User.js'

describe('Web push', () => {
  let server, baseUrl, saved
  before(async () => {
    await setupTestDb()
    saved = { pub: config.VAPID_PUBLIC_KEY, priv: config.VAPID_PRIVATE_KEY }
    config.VAPID_PUBLIC_KEY = 'BHL-iwktDxCJRv9Wn7fDH2yIFOJLZ3nhDVUafo13iQdoyzAVTjNN3UJydGP_o9AMWl5qo_exQMgB6Wo6oi_Cfco'
    config.VAPID_PRIVATE_KEY = 'NEBDJCqFQR3xhcKfMYsR0EnfrB-TC5BzEHiAL7wtbnw'
    config.VAPID_SUBJECT = 'mailto:test@wiselaundry.app'
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
  })
  after(async () => { config.VAPID_PUBLIC_KEY = saved.pub; config.VAPID_PRIVATE_KEY = saved.priv; server.close(); await teardownTestDb() })
  beforeEach(async () => { await clearTestDb() })

  const headers = (cookie) => ({ 'Content-Type': 'application/json', cookie, 'x-test-bypass-csrf': '1' })
  const post = (cookie, path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body ?? {}) })
  const get = (cookie, path) => fetch(`${baseUrl}${path}`, { headers: headers(cookie) })
  async function signup(email) {
    const reg = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-bypass-csrf': '1' }, body: JSON.stringify({ fullName: 'Push Tester', email, phone: '9876543210', password: 'Password123!' }) })
    return reg.headers.getSetCookie().find((c) => c.startsWith('wise_session=')).split(';')[0]
  }
  const fakeSub = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'BPp' + 'x'.repeat(84), auth: 'abcd' + 'y'.repeat(18) } })

  test('key endpoint returns the public key', async () => {
    const cookie = await signup('a@example.com')
    const { data } = await (await get(cookie, '/push/key')).json()
    assert.equal(data.publicKey, 'BHL-iwktDxCJRv9Wn7fDH2yIFOJLZ3nhDVUafo13iQdoyzAVTjNN3UJydGP_o9AMWl5qo_exQMgB6Wo6oi_Cfco')
  })

  test('subscribe stores one row per device; re-subscribe upserts', async () => {
    const cookie = await signup('a@example.com')
    assert.equal((await post(cookie, '/push/subscribe', { subscription: fakeSub(1) })).status, 201)
    await post(cookie, '/push/subscribe', { subscription: fakeSub(1) }) // same endpoint again
    await post(cookie, '/push/subscribe', { subscription: fakeSub(2) })
    const user = await User.findOne({ email: 'a@example.com' })
    assert.equal(await PushSubscription.countDocuments({ userId: user._id }), 2)
  })

  test('a bad subscription is rejected', async () => {
    const cookie = await signup('a@example.com')
    assert.equal((await post(cookie, '/push/subscribe', { subscription: { endpoint: 'x' } })).status, 400)
  })

  test('unsubscribe removes the device', async () => {
    const cookie = await signup('a@example.com')
    await post(cookie, '/push/subscribe', { subscription: fakeSub(9) })
    await post(cookie, '/push/unsubscribe', { endpoint: 'https://push.example/9' })
    assert.equal(await PushSubscription.countDocuments({}), 0)
  })

  test('notifyUser is a safe no-op when the user has no devices', async () => {
    const cookie = await signup('a@example.com')
    const user = await User.findOne({ email: 'a@example.com' })
    await notifyUser(user._id, { title: 'Hi', body: 'test' }) // no subscriptions -> resolves, no network
    assert.equal(await PushSubscription.countDocuments({ userId: user._id }), 0)
  })

  test('push requires login', async () => {
    assert.equal((await fetch(`${baseUrl}/push/key`)).status, 401)
  })
})
