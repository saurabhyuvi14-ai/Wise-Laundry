import { demoServices } from './services'
import { demoAddresses } from './addresses'

// DEMO FIXTURE — orders generated relative to "now" so the demo always looks current.

const HOUR = 3600 * 1000
const DAY = 24 * HOUR

function at(daysFromNow, hour, minute = 0) {
  const d = new Date(Date.now() + daysFromNow * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function snapshot(address) {
  const { id: _id, isDefault: _d, ...rest } = address
  return rest
}

function item(serviceId, quantity = null) {
  const s = demoServices.find((x) => x.id === serviceId)
  return { serviceId, serviceName: s.name, pricingUnit: s.pricingUnit, quantity, unitPricePaise: s.unitPricePaise }
}

function history(entries) {
  return entries.map(([status, changedAt, note]) => ({ status, changedAt, note }))
}

export function createDemoOrders() {
  const home = snapshot(demoAddresses[0])
  const work = snapshot(demoAddresses[1])

  return [
    {
      id: 'order_1044',
      reference: 'WL-1044',
      items: [item('service_iron_only')],
      addressSnapshot: home,
      pickupScheduledAt: at(2, 10),
      pickupSlotHours: 2,
      instructions: '',
      estimatedDeliveryAt: null,
      statusHistory: history([['BOOKED', at(0, 9, 12), 'Pickup requested by you.']]),
      createdAt: at(0, 9, 12),
    },
    {
      id: 'order_1042',
      reference: 'WL-1042',
      items: [item('service_wash_iron', 4.5)],
      addressSnapshot: home,
      pickupScheduledAt: at(-1, 9),
      pickupSlotHours: 2,
      instructions: 'Call on arrival at the gate.',
      estimatedDeliveryAt: at(1, 18),
      statusHistory: history([
        ['BOOKED', at(-2, 20, 4), 'Pickup requested by you.'],
        ['PICKED_UP', at(-1, 9, 40), 'Bag collected by our pickup partner.'],
        ['RECEIVED', at(-1, 11, 20), 'Weighed at 4.5 kg. Final price confirmed.'],
        ['WASHING', at(0, 8, 15)],
      ]),
      createdAt: at(-2, 20, 4),
    },
    {
      id: 'order_1039',
      reference: 'WL-1039',
      items: [item('service_wash_fold', 3.2)],
      addressSnapshot: work,
      pickupScheduledAt: at(-7, 10),
      pickupSlotHours: 2,
      instructions: '',
      estimatedDeliveryAt: at(-5, 18),
      statusHistory: history([
        ['BOOKED', at(-8, 18, 30)],
        ['PICKED_UP', at(-7, 10, 25)],
        ['RECEIVED', at(-7, 12, 5), 'Weighed at 3.2 kg.'],
        ['WASHING', at(-6, 9, 0)],
        ['OUT_FOR_DELIVERY', at(-5, 15, 10)],
        ['DELIVERED', at(-5, 16, 2), 'Handed over at reception.'],
      ]),
      createdAt: at(-8, 18, 30),
    },
    {
      id: 'order_1035',
      reference: 'WL-1035',
      items: [item('service_iron_only', 8)],
      addressSnapshot: home,
      pickupScheduledAt: at(-13, 16),
      pickupSlotHours: 2,
      instructions: 'Office shirts — light starch please.',
      estimatedDeliveryAt: at(-10, 18),
      statusHistory: history([
        ['BOOKED', at(-14, 11, 0)],
        ['PICKED_UP', at(-13, 16, 40)],
        ['RECEIVED', at(-13, 18, 0), '8 items counted.'],
        ['OUT_FOR_DELIVERY', at(-10, 16, 0)],
        ['DELIVERED', at(-10, 17, 20)],
      ]),
      createdAt: at(-14, 11, 0),
    },
    {
      id: 'order_1030',
      reference: 'WL-1030',
      items: [item('service_wash_fold')],
      addressSnapshot: home,
      pickupScheduledAt: at(-20, 18),
      pickupSlotHours: 2,
      instructions: '',
      estimatedDeliveryAt: null,
      statusHistory: history([
        ['BOOKED', at(-21, 9, 0)],
        ['CANCELLED', at(-21, 13, 0), 'Cancelled at your request.'],
      ]),
      createdAt: at(-21, 9, 0),
    },
  ]
}
