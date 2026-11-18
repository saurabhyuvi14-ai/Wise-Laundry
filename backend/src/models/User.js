import mongoose from 'mongoose'
import argon2 from 'argon2'

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    // Not required for people who only sign in with Google.
    passwordHash: {
      type: String,
      required() {
        return !this.googleId
      },
    },
    // Google's account id ("sub"). Set when the user signs in with Google.
    googleId: {
      type: String,
      default: undefined,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
      default: 'CUSTOMER',
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString()
        ret.name = ret.fullName // compatibility with legacy frontends
        delete ret._id
        delete ret.__v
        delete ret.passwordHash
        delete ret.googleId
        delete ret.emailVerificationToken
        delete ret.emailVerificationExpires
        delete ret.passwordResetToken
        delete ret.passwordResetExpires
        return ret
      },
    },
  },
)

userSchema.statics.hashPassword = async function (plainPassword) {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })
}

userSchema.index({ googleId: 1 }, { unique: true, sparse: true })

userSchema.methods.verifyPassword = async function (plainPassword) {
  if (!this.passwordHash) return false // Google-only account
  return argon2.verify(this.passwordHash, plainPassword)
}

export const User = mongoose.model('User', userSchema)

