import mongoose from 'mongoose'
import { config } from './env.js'
import { logger } from './logger.js'

let memoryServerInstance = null

export async function connectDatabase(overrideUri) {
  let uri = overrideUri || (config.NODE_ENV === 'test' ? config.MONGODB_TEST_URI : config.MONGODB_URI)

  try {
    mongoose.set('strictQuery', true)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    })
    logger.info({ uri: sanitizeUri(uri) }, 'Connected to MongoDB')
    return mongoose.connection
  } catch (err) {
    if (config.NODE_ENV === 'development' && !overrideUri) {
      logger.warn('External MongoDB not reachable. Starting embedded MongoMemoryServer for development...')
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      memoryServerInstance = await MongoMemoryServer.create({
        instance: { dbName: 'wise_laundry_dev' },
      })
      uri = memoryServerInstance.getUri()
      await mongoose.connect(uri)
      logger.info({ uri: sanitizeUri(uri) }, 'Connected to embedded MongoMemoryServer')
      return mongoose.connection
    }
    logger.error({ err: err.message }, 'MongoDB connection failure')
    throw err
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop()
    memoryServerInstance = null
  }
}

export function isDbReady() {
  // 1: connected, 2: connecting
  return mongoose.connection.readyState === 1
}

function sanitizeUri(uri) {
  try {
    return uri.replace(/:([^@]+)@/, ':***@')
  } catch {
    return 'mongodb://***'
  }
}
