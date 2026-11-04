const TZ_LABEL = 'IST'

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

export function formatDate(value, opts = {}) {
  if (!value) return '—'
  return toDate(value).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  })
}

export function formatShortDate(value) {
  if (!value) return '—'
  return toDate(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function formatTime(value) {
  if (!value) return '—'
  return toDate(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  return `${formatShortDate(value)}, ${formatTime(value)}`
}

export function formatRelative(value) {
  if (!value) return '—'
  const diff = Math.round((Date.now() - toDate(value).getTime()) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return formatDateTime(value)
}

/** "06 Nov, 10 AM – 12 PM" from an ISO start and a slot length in hours. */
export function formatSlot(startIso, hours = 2) {
  if (!startIso) return '—'
  const start = toDate(startIso)
  const end = new Date(start.getTime() + hours * 3600 * 1000)
  const t = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }).toUpperCase()
  return `${formatShortDate(start)}, ${t(start)} – ${t(end)}`
}

export function isSameDay(a, b) {
  return toDate(a).toDateString() === toDate(b).toDateString()
}

export { TZ_LABEL }
