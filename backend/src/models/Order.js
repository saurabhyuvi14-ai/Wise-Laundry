import { getChangeRules, getExpressRules } from '../services/orderPolicy.js'
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
      enum: [
        'BOOKED',
        'PICKED_UP',
        'RECEIVED',
        'WASHING',
        'IRONING',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
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
    // Express delivery, with the terms the customer saw when booking (so later setting changes don't affect it).
    express: {
      enabled: { type: Boolean, default: false },
      surchargePercent: { type: Number, default: 0 },
      turnaroundHours: { type: Number, default: null },
    },
    // The saved address used to book (the snapshot below keeps the address as it was).
    addressId: {
      type: String,
      default: null,
    },
    addressSnapshot: {
      label: String,
      recipientName: String,
      phone: String,
      addressLine1Encrypted: String,
      addressLine2Encrypted: String,
      landmark: String,
      city: String,
      state: String,
      postalCode: String,
      coordinatesEncrypted: String,
      locationAccuracyMeters: Number,
      locationSource: String,
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
      enum: [
        'BOOKED',
        'PICKED_UP',
        'RECEIVED',
        'WASHING',
        'IRONING',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'BOOKED',
      index: true,
    },
    // Final bill, written by staff after weighing / counting.
    bill: {
      lines: {
        type: [
          new mongoose.Schema(
            { label: String, detail: String, amountPaise: Number },
            { _id: false },
          ),
        ],
        default: undefined,
      },
      subtotalPaise: { type: Number, default: null },
      totalPaise: { type: Number, default: null },
      finalizedAt: { type: Date, default: null },
      finalizedBy: { type: String, default: null },
      revision: { type: Number, default: 0 },
    },
    // Cancel / reschedule
    rescheduleCount: {
      type: Number,
      default: 0,
    },
    scheduleHistory: {
      type: [
        new mongoose.Schema(
          {
            from: { type: Date, required: true },
            to: { type: Date, required: true },
            changedAt: { type: Date, default: Date.now },
            changedBy: { type: String, default: 'CUSTOMER' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    cancellation: {
      reason: { type: String, default: null },
      note: { type: String, default: '' },
      cancelledAt: { type: Date, default: null },
      cancelledBy: { type: String, default: null },
    },
    // 4-digit code the customer gives the rider at delivery (stored encrypted), and wrong tries.
    deliveryCodeEncrypted: { type: String, default: null },
    deliveryCodeTries: { type: Number, default: 0 },
    // Rider doing the current pickup or delivery (set by staff).
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Customer's rating after delivery (one per order), plus an optional problem report.
    feedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      tags: { type: [String], default: undefined },
      comment: { type: String, default: '' },
      issue: {
        type: { type: String, default: null },
        note: { type: String, default: '' },
      },
      createdAt: { type: Date, default: null },
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
        if (ret.addressSnapshot) {
          let coordinates = null
          if (ret.addressSnapshot.coordinatesEncrypted) {
            try {
              coordinates = JSON.parse(decrypt(ret.addressSnapshot.coordinatesEncrypted))
            } catch {
              coordinates = null
            }
          }
          ret.addressSnapshot = {
            label: ret.addressSnapshot.label,
            recipientName: ret.addressSnapshot.recipientName,
            phone: ret.addressSnapshot.phone,
            addressLine1: decrypt(ret.addressSnapshot.addressLine1Encrypted),
            addressLine2: decrypt(ret.addressSnapshot.addressLine2Encrypted),
            landmark: ret.addressSnapshot.landmark || '',
            city: ret.addressSnapshot.city,
            state: ret.addressSnapshot.state || '',
            postalCode: ret.addressSnapshot.postalCode,
            pincode: ret.addressSnapshot.postalCode,
            coordinates,
            locationAccuracyMeters: ret.addressSnapshot.locationAccuracyMeters ?? null,
            locationSource: ret.addressSnapshot.locationSource || 'MANUAL',
            instructions: decrypt(ret.addressSnapshot.instructionsEncrypted) || '',
          }
        }
        ret.instructions = decrypt(ret.instructionsEncrypted) || ''
        ret.updatedAt = ret.updatedAt ? ret.updatedAt.toISOString() : ret.createdAt ? ret.createdAt.toISOString() : new Date().toISOString()
        ret.createdAt = ret.createdAt ? ret.createdAt.toISOString() : new Date().toISOString()
        ret.pickupScheduledAt = ret.pickupScheduledAt ? ret.pickupScheduledAt.toISOString() : null
        ret.estimatedDeliveryAt = ret.estimatedDeliveryAt ? ret.estimatedDeliveryAt.toISOString() : null

        // What the customer can still change, worked out on the server's clock.
        ret.changeRules = getChangeRules(doc)
        ret.expressRules = getExpressRules(doc)
        ret.rescheduleCount = ret.rescheduleCount || 0
        ret.scheduleHistory = (ret.scheduleHistory || []).map((h) => ({
          from: h.from?.toISOString?.() ?? h.from,
          to: h.to?.toISOString?.() ?? h.to,
          changedAt: h.changedAt?.toISOString?.() ?? h.changedAt,
          changedBy: h.changedBy,
        }))
        ret.express = ret.express?.enabled
          ? { surchargePercent: ret.express.surchargePercent, turnaroundHours: ret.express.turnaroundHours }
          : null
        ret.feedback = ret.feedback?.createdAt
          ? {
              rating: ret.feedback.rating,
              tags: ret.feedback.tags || [],
              comment: ret.feedback.comment || '',
              issue: ret.feedback.issue?.type ? { type: ret.feedback.issue.type, note: ret.feedback.issue.note || '' } : null,
              createdAt: ret.feedback.createdAt.toISOString(),
            }
          : null
        ret.cancellation = ret.cancellation?.cancelledAt
          ? {
              reason: ret.cancellation.reason,
              note: ret.cancellation.note || '',
              cancelledAt: ret.cancellation.cancelledAt.toISOString(),
              cancelledBy: ret.cancellation.cancelledBy,
            }
          : null

        const priced = ret.items.length > 0 && ret.items.every((i) => i.quantity != null)
        ret.bill = ret.bill?.finalizedAt
          ? {
              lines: ret.bill.lines || [],
              subtotalPaise: ret.bill.subtotalPaise,
              totalPaise: ret.bill.totalPaise,
              finalizedAt: ret.bill.finalizedAt.toISOString(),
              revision: ret.bill.revision || 1,
            }
          : null
        ret.totalPaise = ret.bill
          ? ret.bill.totalPaise
          : priced
            ? Math.round(ret.items.reduce((acc, i) => acc + i.quantity * i.unitPricePaise, 0))
            : null

        delete ret._id
        delete ret.__v
        delete ret.orderIdString
        delete ret.instructionsEncrypted
        delete ret.riderId
        delete ret.deliveryCodeEncrypted
        delete ret.deliveryCodeTries
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
    state: rawAddress.state || '',
    postalCode: rawAddress.postalCode,
    coordinatesEncrypted: rawAddress.coordinates ? encrypt(JSON.stringify(rawAddress.coordinates)) : '',
    locationAccuracyMeters: rawAddress.locationAccuracyMeters ?? null,
    locationSource: rawAddress.locationSource || 'MANUAL',
    instructionsEncrypted: encrypt(rawAddress.instructions || ''),
  }
}

orderSchema.methods.setEncryptedInstructions = function (rawInstructions) {
  this.instructionsEncrypted = encrypt(rawInstructions || '')
}

export const Order = mongoose.model('Order', orderSchema)

