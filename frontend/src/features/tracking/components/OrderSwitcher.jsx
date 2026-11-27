import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { STATUS, isActive, stageLabel } from '../../orders/components/OrderStatusBadge'
import { cn } from '../../../utils/cn'

/**
 * Swipeable row of order cards on the tracking page. Active orders come first.
 * Tap a card (or use the arrows) to switch which order is tracked.
 */
export function OrderSwitcher({ orders, currentId, services }) {
  const navigate = useNavigate()
  const rowRef = useRef(null)
  const list = [...orders].sort(
    (a, b) => Number(isActive(b.currentStatus)) - Number(isActive(a.currentStatus)) || new Date(b.updatedAt) - new Date(a.updatedAt),
  )
  const idx = list.findIndex((o) => o.id === currentId)

  // Keep the selected card in view.
  useEffect(() => {
    rowRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [currentId])

  const go = (o) => o && o.id !== currentId && navigate(`/customer/orders/${o.id}/tracking`, { replace: true })
  if (list.length < 2) return null

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ArrowButton label="Previous order" disabled={idx <= 0} onClick={() => go(list[idx - 1])}><ChevronLeft className="size-4" /></ArrowButton>
      <div
        ref={rowRef}
        className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Your orders"
      >
        {list.map((o) => {
          const service = services?.find((s) => s.id === o.items[0].serviceId)
          const stages = service?.stages ?? []
          const at = stages.indexOf(o.currentStatus)
          const pct = o.currentStatus === 'DELIVERED' ? 100 : stages.length && at >= 0 ? ((at + 1) / stages.length) * 100 : 0
          const selected = o.id === currentId
          const Icon = STATUS[o.currentStatus]?.icon
          return (
            <button
              key={o.id}
              type="button"
              role="listitem"
              aria-current={selected || undefined}
              onClick={() => go(o)}
              className={cn(
                'w-44 shrink-0 snap-center rounded-2xl border bg-white px-3.5 py-3 text-left transition sm:w-52',
                selected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-line hover:border-navy-400/50',
                !isActive(o.currentStatus) && !selected && 'opacity-70',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{o.reference}</span>
                {Icon && <Icon className={cn('size-4', selected ? 'text-brand-700' : 'text-navy-400')} aria-hidden />}
              </span>
              <span className="mt-0.5 block truncate text-xs text-navy-500">{o.items[0].serviceName}</span>
              <span className={cn('mt-1.5 block truncate text-xs font-semibold', o.currentStatus === 'CANCELLED' ? 'text-red-600' : 'text-brand-700')}>
                {stageLabel(o.currentStatus, service)}
              </span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-canvas">
                <span className={cn('block h-full rounded-full', o.currentStatus === 'CANCELLED' ? 'bg-red-300' : 'bg-brand-500')} style={{ width: `${o.currentStatus === 'CANCELLED' ? 100 : pct}%` }} />
              </span>
            </button>
          )
        })}
      </div>
      <ArrowButton label="Next order" disabled={idx < 0 || idx >= list.length - 1} onClick={() => go(list[idx + 1])}><ChevronRight className="size-4" /></ArrowButton>
    </div>
  )
}

function ArrowButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="hidden size-9 shrink-0 place-items-center rounded-full border border-line bg-white text-navy-700 transition hover:border-navy-400/50 disabled:opacity-30 sm:grid"
    >
      {children}
    </button>
  )
}
