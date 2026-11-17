import mongoose from 'mongoose'
import { config } from './env.js'
import { logger } from './logger.js'

export async function connectDatabase(overrideUri) {
  const uri = overrideUri || (config.NODE_ENV === 'test' ? (config.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/wise_laundry_test') : config.MONGODB_URI)

  if (!uri) {
    const errorMsg = 'No MongoDB connection URI provided. Configure MONGODB_URI for your MongoDB Atlas cluster.'
    logger.fatal(errorMsg)
    throw new Error(errorMsg)
  }

  try {
    mongoose.set('strictQuery', true)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    })
    logger.info({ uri: sanitizeUri(uri) }, 'Connected to MongoDB Atlas database')
    return mongoose.connection
  } catch (err) {
    logger.fatal(
      { err: err.message, uri: sanitizeUri(uri) },
      'Failed to connect to MongoDB Atlas database. Please verify your Atlas cluster connection string, network access IP whitelist, and credentials in backend/.env',
    )
    throw err
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
    logger.info('Disconnected from MongoDB')
  }
}

export function isDbReady() {
  // 1: connected, 2: connecting
  return mongoose.connection.readyState === 1
}

export function sanitizeUri(uri) {
  if (!uri) return 'undefined'
  try {
    return uri.replace(/:([^@]+)@/, ':***@')
  } catch {
    return 'mongodb://***'
  }
}
