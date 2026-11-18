// Entry point when the backend runs on Vercel (each request is handled by this function).
// Locally the backend still starts with `npm run dev` (src/server.js); this file is only used by Vercel.
import app from '../src/app.js'
import { connectDatabase } from '../src/config/db.js'
import { seedInitialServices } from '../src/utils/seed.js'

// Connect once per running instance and reuse it. If connecting fails, try again on the next request.
let ready
function ensureDatabase() {
  ready ??= connectDatabase()
    .then(seedInitialServices)
    .catch((err) => {
      ready = undefined
      throw err
    })
  return ready
}

export default async function handler(req, res) {
  try {
    await ensureDatabase()
  } catch {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'We could not reach the database. Please try again shortly.' } }))
  }
  return app(req, res)
}
