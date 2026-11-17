import app from './app.js'
import { config } from './config/env.js'
import { logger } from './config/logger.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { seedInitialServices } from './utils/seed.js'

async function startServer() {
  try {
    logger.info('Initializing Wise Laundry backend service...')
    await connectDatabase()
    await seedInitialServices()

    const server = app.listen(config.PORT, () => {
      logger.info(
        { port: config.PORT, env: config.NODE_ENV },
        `Wise Laundry Express API listening on http://localhost:${config.PORT}`,
      )
    })

    const shutdown = async (signal) => {
      logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`)
      server.close(async () => {
        await disconnectDatabase()
        logger.info('Database disconnected and HTTP server closed gracefully')
        process.exit(0)
      })
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout')
        process.exit(1)
      }, 10000).unref()
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (err) {
    logger.fatal({ err: err.message }, 'Failed to start server. Terminating process.')
    process.exit(1)
  }
}

startServer()

