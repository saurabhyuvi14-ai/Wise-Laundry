import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { seedInitialServices } from '../../src/utils/seed.js'

let mongod = null

export async function setupTestDb() {
  process.env.NODE_ENV = 'test'
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  await mongoose.connect(uri)
  await seedInitialServices()
  return uri
}

export async function clearTestDb() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections
    for (const key of Object.keys(collections)) {
      if (key !== 'services') {
        // preserve services catalogue
        await collections[key].deleteMany({})
      }
    }
  }
}

export async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  if (mongod) {
    await mongod.stop()
    mongod = null
  }
}
