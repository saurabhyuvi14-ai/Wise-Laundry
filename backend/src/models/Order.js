import mongoose from 'mongoose'
import { encrypt, decrypt } from '../utils/crypto.js'

const orderItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    pricingUnit: {
      type: String,
      enum: ['KG', 'PIECE'],
      required: true,
    },
    quantity: {
      type: Number,
      default: null,
    },
    unitPricePaise: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
)

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    orderIdString: {
      type: String,
      unique: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },
    addressSnapshot: {
      label: String,
      recipientName: String,
      phone: String,
      addressLine1Encrypted: String,
      addressLine2Encrypted: String,
      landmark: String,
      city: String,
      postalCode: String,
      instructionsEncrypted: String,
    },
    pickupScheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    pickupSlotHours: {
      type: Number,
      default: 2,
    },
    instructionsEncrypted: {
      type: String,
      default: '',
    },
    estimatedDeliveryAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    currentStatus: {
      type: String,
      enum: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'BOOKED',
      index: true,
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.orderIdString || ret._id.toString()
        // Decrypt address snapshot
        if (ret.addressSnapshot) {
          ret.addressSnapshot = {
            label: ret.addressSnapshot.label,
            recipientName: ret.addressSnapshot.recipientName,
            phone: ret.addressSnapshot.phone,
            addressLine1: decrypt(ret.addressSnapshot.addressLine1Encrypted),
            addressLine2: decrypt(ret.addressSnapshot.addressLine2Encrypted),
            landmark: ret.addressSnapshot.landmark || '',
            city: ret.addressSnapshot.city,
            postalCode: ret.addressSnapshot.postalCode,
            instructions: decrypt(ret.addressSnapshot.instructionsEncrypted) || '',
          }
        }
        ret.instructions = decrypt(ret.instructionsEncrypted) || ''
        ret.updatedAt = ret.updatedAt ? ret.updatedAt.toISOString() : ret.createdAt.toISOString()
        ret.createdAt = ret.createdAt ? ret.createdAt.toISOString() : new Date().toISOString()
        ret.pickupScheduledAt = ret.pickupScheduledAt ? ret.pickupScheduledAt.toISOString() : null
        ret.estimatedDeliveryAt = ret.estimatedDeliveryAt ? ret.estimatedDeliveryAt.toISOString() : null

        // Calculate total paise if all items have quantities
        const priced = ret.items.length > 0 && ret.items.every((i) => i.quantity != null)
        ret.totalPaise = priced ? Math.round(ret.items.reduce((acc, i) => acc + i.quantity * i.unitPricePaise, 0)) : null

        delete ret._id
        delete ret.__v
        delete ret.orderIdString
        delete ret.instructionsEncrypted
        return ret
      },
    },
  },
)

orderSchema.methods.setEncryptedAddressSnapshot = function (rawAddress) {
  this.addressSnapshot = {
    label: rawAddress.label,
    recipientName: rawAddress.recipientName,
    phone: rawAddress.phone,
    addressLine1Encrypted: encrypt(rawAddress.addressLine1),
    addressLine2Encrypted: encrypt(rawAddress.addressLine2),
    landmark: rawAddress.landmark || '',
    city: rawAddress.city,
    postalCode: rawAddress.postalCode,
    instructionsEncrypted: encrypt(rawAddress.instructions || ''),
  }
}

orderSchema.methods.setEncryptedInstructions = function (rawInstructions) {
  this.instructionsEncrypted = encrypt(rawInstructions || '')
}

export const Order = mongoose.model('Order', orderSchema)
