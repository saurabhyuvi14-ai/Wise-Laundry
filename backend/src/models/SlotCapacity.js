import mongoose from 'mongoose'
import { ApiError } from '../utils/errors.js'
import { config } from '../config/env.js'

const slotCapacitySchema = new mongoose.Schema(
  {
    slotKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    slotHour: {
      type: Number,
      required: true,
      index: true,
    },
    bookedCount: {
      type: Number,
      default: 0,
    },
    maxCapacity: {
      type: Number,
      default: () => config?.DEFAULT_SLOT_CAPACITY || 5,
    },
  },
  {
    timestamps: true,
  },
)

slotCapacitySchema.statics.reserveSlot = async function (
  dateStr,
  slotHour,
  maxCapacity = config?.DEFAULT_SLOT_CAPACITY || 5,
) {
  const slotKey = `${dateStr}_${slotHour}`

  // Ensure slot document exists
  await this.updateOne(
    { slotKey },
    {
      $setOnInsert: {
        slotKey,
        date: dateStr,
        slotHour,
        maxCapacity,
        bookedCount: 0,
      },
    },
    { upsert: true },
  )

  // Atomically increment if under maxCapacity
  const updated = await this.findOneAndUpdate(
    {
      slotKey,
      bookedCount: { $lt: maxCapacity },
    },
    { $inc: { bookedCount: 1 } },
    { new: true },
  )

  if (!updated) {
    throw ApiError.conflict('The selected pickup slot is fully booked. Please select another time window.', {
      pickupScheduledAt: 'This 2-hour slot has reached full capacity.',
    })
  }

  return updated
}

slotCapacitySchema.statics.releaseSlot = async function (dateStr, slotHour) {
  const slotKey = `${dateStr}_${slotHour}`
  await this.updateOne(
    { slotKey, bookedCount: { $gt: 0 } },
    { $inc: { bookedCount: -1 } },
  )
}

slotCapacitySchema.statics.getSlotAvailability = async function (
  dateStr,
  slotHour,
  maxCapacity = config?.DEFAULT_SLOT_CAPACITY || 5,
) {
  const slotKey = `${dateStr}_${slotHour}`
  const found = await this.findOne({ slotKey })
  const booked = found ? found.bookedCount : 0
  const max = found ? found.maxCapacity : maxCapacity
  return {
    date: dateStr,
    slotHour,
    booked,
    maxCapacity: max,
    available: Math.max(0, max - booked),
    isFull: booked >= max,
  }
}

export const SlotCapacity = mongoose.model('SlotCapacity', slotCapacitySchema)

