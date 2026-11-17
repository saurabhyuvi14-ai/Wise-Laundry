import { isDbReady } from '../config/db.js'

export async function getHealth(_req, res) {
  const ready = isDbReady()
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'healthy' : 'unhealthy',
    database: {
      ready,
      state: ready ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  })
}

