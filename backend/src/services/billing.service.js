import { config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'

const UNIT_WORD = { KG: 'kg', PIECE: 'items' }
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

/** Express settings for one service, or null if express isn't offered for it. */
export function expressFor(service) {
  if (!config?.EXPRESS_ENABLED || !service) return null
  const hours = Math.min(config.EXPRESS_TURNAROUND_HOURS ?? 24, Math.ceil((service.turnaroundHours || 48) / 2))
  // No point offering express if it isn't actually faster.
  if (hours >= (service.turnaroundHours || 48)) return null
  return { turnaroundHours: hours, surchargePercent: config.EXPRESS_SURCHARGE_PERCENT ?? 50 }
}

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
export function computeBill(item, quantity, { express = null } = {}) {
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
  if (express?.surchargePercent > 0) {
    const extra = Math.round((serviceAmount * express.surchargePercent) / 100)
    lines.push({ label: 'Express delivery', detail: `+${express.surchargePercent}% for faster delivery`, amountPaise: extra })
    subtotal += extra
  }
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

/** The express terms saved on an order (null for standard). */
export function orderExpress(order) {
  return order?.express?.enabled ? { surchargePercent: order.express.surchargePercent || 0, turnaroundHours: order.express.turnaroundHours } : null
}

/** Delivery time for an order: its saved express hours, otherwise the service's normal time. */
export function orderTurnaroundHours(order, service) {
  return orderExpress(order)?.turnaroundHours || service?.turnaroundHours || 48
}

// ---------- UPI payment (money goes straight to our UPI ID, no gateway) ----------

export const upiConfigured = () => Boolean(config?.UPI_ID)
export const cashAllowed = () => config?.PAYMENT_CASH_ALLOWED !== false

/**
 * The UPI details to pay this order directly to our UPI ID. Null when UPI isn't set up,
 * the bill isn't ready, or it's already paid. `link` is a standard UPI intent that opens
 * any UPI app with the amount prefilled; the frontend also renders it as a QR to scan.
 */
export function buildUpiIntent(order) {
  if (!upiConfigured() || !order.bill?.totalPaise || order.payment?.status === 'PAID') return null
  const amount = (order.bill.totalPaise / 100).toFixed(2)
  const payeeName = config.UPI_PAYEE_NAME || 'Wise Laundry'
  const note = `${payeeName} ${order.reference}`
  const link =
    `upi://pay?pa=${encodeURIComponent(config.UPI_ID)}&pn=${encodeURIComponent(payeeName)}` +
    `&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
  return { upiId: config.UPI_ID, payeeName, amount, amountPaise: order.bill.totalPaise, note, link, cashAllowed: cashAllowed() }
}
