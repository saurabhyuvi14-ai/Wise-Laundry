import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['WASH_FOLD', 'WASH_IRON', 'IRON_ONLY'],
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    pricingUnit: {
      type: String,
      enum: ['KG', 'PIECE'],
      required: true,
    },
    unitPricePaise: {
      type: Number,
      required: true,
    },
    turnaroundHours: {
      type: Number,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    stages: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret.serviceId
        delete ret._id
        delete ret.serviceId
        delete ret.__v
        return ret
      },
    },
  },
)

export const Service = mongoose.model('Service', serviceSchema)

