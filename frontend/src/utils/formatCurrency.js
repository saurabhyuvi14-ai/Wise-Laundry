const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** Backend sends money as integer paise. */
export function formatCurrency(paise) {
  if (paise == null) return '—'
  return inr.format(paise / 100)
}

export const UNIT_LABEL = { KG: 'per kg', PIECE: 'per item' }
