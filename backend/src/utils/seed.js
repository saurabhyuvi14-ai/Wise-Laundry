import { Service } from '../models/Service.js'
import { logger } from '../config/logger.js'

export const DEFAULT_SERVICES = [
  {
    serviceId: 'service_wash_fold',
    code: 'WASH_FOLD',
    name: 'Wash & Fold',
    description: 'Everyday clothes washed, dried and neatly folded.',
    pricingUnit: 'KG',
    unitPricePaise: 6000,
    turnaroundHours: 48,
    active: true,
    stages: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  },
  {
    serviceId: 'service_wash_iron',
    code: 'WASH_IRON',
    name: 'Wash & Iron',
    description: 'Washed, dried and pressed — ready to wear.',
    pricingUnit: 'KG',
    unitPricePaise: 9000,
    turnaroundHours: 48,
    active: true,
    stages: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  },
  {
    serviceId: 'service_iron_only',
    code: 'IRON_ONLY',
    name: 'Iron Only',
    description: 'Already clean? We press and fold them for you.',
    pricingUnit: 'PIECE',
    unitPricePaise: 1500,
    turnaroundHours: 24,
    active: true,
    stages: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  },
]

export async function seedInitialServices() {
  const count = await Service.countDocuments()
  if (count === 0) {
    await Service.insertMany(DEFAULT_SERVICES)
    logger.info('Default laundry services catalogue seeded into database')
  }
}
