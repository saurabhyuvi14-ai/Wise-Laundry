// DEMO FIXTURE — demo prices only. Real catalogue comes from GET /services.
// Tracking stages per service (no separate Ironing / Ready steps — team decision).
export const demoServices = [
  {
    id: 'service_wash_fold',
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
    id: 'service_wash_iron',
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
    id: 'service_iron_only',
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
