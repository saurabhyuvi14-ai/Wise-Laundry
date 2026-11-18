import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { seedInitialServices } from '../../src/utils/seed.js'

let mongod

export async function setupTestDb() {
  process.env.NODE_ENV = 'test'
  // Use MONGODB_TEST_URI when given (e.g. a local test database); otherwise start an in-memory MongoDB.
  let uri = process.env.MONGODB_TEST_URI
  if (!uri) {
    mongod = await MongoMemoryServer.create()
    uri = mongod.getUri()
  }
  await mongoose.connect(uri)
  await seedInitialServices()
  return { uri }
}

export async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  if (mongod) {
    await mongod.stop()
  }
}

export async function clearTestDb() {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections
    for (const key in collections) {
      if (key !== 'services') {
        await collections[key].deleteMany({})
      }
    }
  }
}

