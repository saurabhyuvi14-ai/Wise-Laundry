import mongoose from 'mongoose'
import { generateSecureToken, hashToken } from '../utils/crypto.js'

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

sessionSchema.statics.createSession = async function (userId, req, days = 7) {
  const rawToken = generateSecureToken(32)
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const session = await this.create({
    userId,
    tokenHash,
    ipAddress: req?.ip || req?.socket?.remoteAddress || 'unknown',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    expiresAt,
  })

  return { session, rawToken }
}

sessionSchema.statics.validateSession = async function (rawToken) {
  if (!rawToken) return null
  const tokenHash = hashToken(rawToken)

  const session = await this.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate('userId')

  if (!session || !session.userId) return null
  return session
}

sessionSchema.statics.revokeSession = async function (rawToken) {
  if (!rawToken) return false
  const tokenHash = hashToken(rawToken)
  const result = await this.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } })
  return result.modifiedCount > 0
}

sessionSchema.statics.revokeAllUserSessions = async function (userId) {
  await this.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
}

export const Session = mongoose.model('Session', sessionSchema)
