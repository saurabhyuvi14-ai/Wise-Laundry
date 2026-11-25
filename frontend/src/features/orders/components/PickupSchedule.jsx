import { useMemo } from 'react'
import { cn } from '../../../utils/cn'

export const SLOT_HOURS = 2
const SLOT_STARTS = [8, 10, 12, 14, 16, 18]

const pad = (n) => String(n).padStart(2, '0')
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hourLabel = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`
export const slotLabel = (h) => `${hourLabel(h)} – ${hourLabel(h + SLOT_HOURS)}`

/** Local date key + hour -> ISO string (sent to backend as UTC). */
export function toPickupIso(dateKey, hour) {
  if (!dateKey || hour == null) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, hour).toISOString()
}

function isSlotOpen(dateKey, hour, minLeadMinutes = 60, excludeIso = null, maxAheadDays = null) {
  const t = new Date(toPickupIso(dateKey, hour)).getTime()
  if (excludeIso && t === new Date(excludeIso).getTime()) return false
  if (maxAheadDays != null && t > Date.now() + maxAheadDays * 24 * 60 * 60 * 1000) return false
  return t > Date.now() + minLeadMinutes * 60 * 1000
}

/**
 * minLeadMinutes: how far ahead a slot must start (rescheduling uses the change cutoff).
 * excludeIso: a slot to hide (the current pickup when rescheduling).
 * maxAheadDays: latest a slot can be (rescheduling allows 7 days ahead).
 */
export function PickupSchedule({ date, slotHour, onChange, error, minLeadMinutes = 60, excludeIso = null, maxAheadDays = null, hint }) {
  const open = (key, h) => isSlotOpen(key, h, minLeadMinutes, excludeIso, maxAheadDays)
  const { days, today, tomorrow } = useMemo(() => {
    const list = []
    const start = new Date()
    for (let i = 0; list.length < 7 && i < 14; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      if (SLOT_STARTS.some((h) => isSlotOpen(toKey(d), h, minLeadMinutes, excludeIso, maxAheadDays))) list.push(d)
    }
    const now = new Date()
    return {
      days: list,
      today: toKey(now),
      tomorrow: toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
    }
  }, [minLeadMinutes, excludeIso, maxAheadDays])

  return (
    <div className="space-y-5">
      <fieldset className="min-w-0">
        <legend className="mb-2.5 text-sm font-medium text-navy-700">Pickup date</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {days.map((d) => {
            const key = toKey(d)
            const selected = key === date
            const top = key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' })
            return (
              <button
                type="button"
                key={key}
                aria-pressed={selected}
                onClick={() => onChange({ date: key, slotHour: slotHour != null && open(key, slotHour) ? slotHour : null })}
                className={cn(
                  'flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition',
                  selected ? 'border-brand-700 bg-brand-700 text-white shadow-lift' : 'border-line bg-white hover:border-navy-400/50',
                )}
              >
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide', selected ? 'text-brand-100' : 'text-navy-500')}>{top}</span>
                <span className="text-lg leading-tight font-extrabold">{d.getDate()}</span>
                <span className={cn('text-xs', selected ? 'text-brand-100' : 'text-navy-500')}>{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset disabled={!date} className="min-w-0">
        <legend className="mb-2.5 text-sm font-medium text-navy-700">Time window</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SLOT_STARTS.map((h) => {
            const isOpen = date && open(date, h)
            const selected = slotHour === h && isOpen
            return (
              <button
                type="button"
                key={h}
                disabled={!isOpen}
                aria-pressed={selected}
                onClick={() => onChange({ slotHour: h })}
                className={cn(
                  'h-11 rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-dashed disabled:text-navy-400/70',
                  selected ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/30' : 'border-line bg-white enabled:hover:border-navy-400/50',
                )}
              >
                {slotLabel(h)}
              </button>
            )
          })}
        </div>
        <p className={cn('mt-3 text-sm', error ? 'font-medium text-red-600' : 'text-navy-500')}>
          {error ?? (date ? (hint ?? 'This is a requested window — we confirm it by SMS before pickup. Times in IST.') : 'Choose a date first.')}
        </p>
      </fieldset>
    </div>
  )
}
