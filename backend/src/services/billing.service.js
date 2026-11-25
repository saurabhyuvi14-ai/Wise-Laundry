import { config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'

const UNIT_WORD = { KG: 'kg', PIECE: 'items' }
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

/** The bill can be written or corrected from pickup until the order leaves for delivery. */
export const BILLABLE_STATUSES = ['PICKED_UP', 'RECEIVED', 'WASHING', 'IRONING', 'READY_FOR_DELIVERY']

export function validateQuantity(pricingUnit, quantity) {
  const q = Number(quantity)
  if (pricingUnit === 'PIECE') {
    if (!Number.isInteger(q) || q < 1 || q > 500) {
      throw ApiError.badRequest('Enter the number of items (1 to 500).', { quantity: 'Whole number from 1 to 500.' })
    }
  } else if (!(q >= 0.1 && q <= 100) || Math.round(q * 10) !== q * 10) {
    throw ApiError.badRequest('Enter the weight in kg (0.1 to 100, one decimal).', { quantity: 'Weight from 0.1 to 100 kg.' })
  }
  return q
}

/**
 * Works out the final bill for one service line, plus the optional extras from settings.
 * Returns { lines: [{ label, detail, amountPaise }], subtotalPaise, totalPaise }.
 */
export function computeBill(item, quantity) {
  const minOrder = config?.BILL_MIN_ORDER_PAISE || 0
  const deliveryFee = config?.BILL_DELIVERY_FEE_PAISE || 0
  const freeAbove = config?.BILL_FREE_DELIVERY_ABOVE_PAISE || 0
  const gstPercent = config?.BILL_GST_PERCENT || 0

  const serviceAmount = Math.round(quantity * item.unitPricePaise)
  const lines = [
    {
      label: item.serviceName,
      detail: `${quantity} ${UNIT_WORD[item.pricingUnit] || ''} × ${rupees(item.unitPricePaise)}`.trim(),
      amountPaise: serviceAmount,
    },
  ]

  let subtotal = serviceAmount
  if (minOrder > 0 && subtotal < minOrder) {
    lines.push({ label: 'Minimum order top-up', detail: `Orders are at least ${rupees(minOrder)}`, amountPaise: minOrder - subtotal })
    subtotal = minOrder
  }

  let total = subtotal
  if (deliveryFee > 0) {
    const free = freeAbove > 0 && subtotal >= freeAbove
    lines.push({
      label: 'Pickup & delivery',
      detail: free ? `Free above ${rupees(freeAbove)}` : '',
      amountPaise: free ? 0 : deliveryFee,
    })
    total += free ? 0 : deliveryFee
  }

  if (gstPercent > 0) {
    const tax = Math.round((total * gstPercent) / 100)
    lines.push({ label: `GST (${gstPercent}%)`, detail: '', amountPaise: tax })
    total += tax
  }

  return { lines, subtotalPaise: subtotal, totalPaise: total }
}
