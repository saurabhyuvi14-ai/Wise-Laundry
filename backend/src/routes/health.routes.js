import { Router } from 'express'
import { isDbReady } from '../config/db.js'

const router = Router()

// GET /api/v1/health
router.get('/', (_req, res) => {
  const dbOk = isDbReady()
  const status = dbOk ? 200 : 503

  return res.status(status).json({
    status: dbOk ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      api: 'up',
      database: dbOk ? 'connected' : 'disconnected',
    },
  })
})

export default router
