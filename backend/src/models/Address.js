import mongoose from 'mongoose'
import { encrypt, decrypt } from '../utils/crypto.js'

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      enum: ['HOME', 'WORK', 'OTHER'],
      default: 'HOME',
      required: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1Encrypted: {
      type: String,
      required: true,
    },
    addressLine2Encrypted: {
      type: String,
      required: true,
    },
    landmark: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      default: 'Bengaluru',
    },
    state: {
      type: String,
      trim: true,
      default: 'Karnataka',
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    coordinatesEncrypted: {
      type: String,
      default: '',
    },
    locationAccuracyMeters: {
      type: Number,
      default: null,
    },
    locationSource: {
      type: String,
      enum: ['GEOLOCATION', 'GEOCODED', 'MANUAL'],
      default: 'MANUAL',
    },
    instructionsEncrypted: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString()
        ret.addressLine1 = decrypt(ret.addressLine1Encrypted)
        ret.addressLine2 = decrypt(ret.addressLine2Encrypted)
        ret.instructions = decrypt(ret.instructionsEncrypted)
        ret.pincode = ret.postalCode // compatibility alias
        if (ret.coordinatesEncrypted) {
          try {
            ret.coordinates = JSON.parse(decrypt(ret.coordinatesEncrypted))
          } catch {
            ret.coordinates = null
          }
        } else {
          ret.coordinates = null
        }
        delete ret._id
        delete ret.__v
        delete ret.userId
        delete ret.addressLine1Encrypted
        delete ret.addressLine2Encrypted
        delete ret.instructionsEncrypted
        delete ret.coordinatesEncrypted
        return ret
      },
    },
  },
)

addressSchema.methods.setSensitiveData = function ({ addressLine1, addressLine2, instructions, coordinates }) {
  if (addressLine1 !== undefined) this.addressLine1Encrypted = encrypt(addressLine1)
  if (addressLine2 !== undefined) this.addressLine2Encrypted = encrypt(addressLine2)
  if (instructions !== undefined) this.instructionsEncrypted = encrypt(instructions)
  if (coordinates !== undefined) {
    this.coordinatesEncrypted = coordinates ? encrypt(JSON.stringify(coordinates)) : ''
  }
}

addressSchema.methods.getDecryptedSnapshot = function () {
  let coordinates = null
  if (this.coordinatesEncrypted) {
    try {
      coordinates = JSON.parse(decrypt(this.coordinatesEncrypted))
    } catch {
      coordinates = null
    }
  }
  return {
    label: this.label,
    recipientName: this.recipientName,
    phone: this.phone,
    addressLine1: decrypt(this.addressLine1Encrypted),
    addressLine2: decrypt(this.addressLine2Encrypted),
    landmark: this.landmark,
    city: this.city,
    state: this.state || '',
    postalCode: this.postalCode,
    pincode: this.postalCode,
    coordinates,
    locationAccuracyMeters: this.locationAccuracyMeters ?? null,
    locationSource: this.locationSource || 'MANUAL',
    instructions: decrypt(this.instructionsEncrypted),
  }
}

export const Address = mongoose.model('Address', addressSchema)

