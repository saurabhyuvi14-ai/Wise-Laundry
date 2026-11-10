import { Check } from 'lucide-react'
import { STATUS } from '../../orders/components/OrderStatusBadge'
import { formatShortDate, formatTime } from '../../../utils/formatDate'
import { cn } from '../../../utils/cn'

/**
 * One step of the horizontal tracker. state: 'done' | 'current' | 'upcoming'.
 * The connector runs from this circle to the next one, so it always fits
 * however narrow the phone is.
 */
export function TrackingStep({ status, label, state, changedAt, isLast }) {
  const Icon = STATUS[status]?.icon
  return (
    <li className="relative flex min-w-0 flex-1 flex-col items-center text-center">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            'absolute top-4 left-[calc(50%+1.25rem)] h-0.5 w-[calc(100%-2.5rem)] rounded-full sm:top-5 sm:left-[calc(50%+1.625rem)] sm:w-[calc(100%-3.25rem)]',
            state === 'done' ? 'bg-brand-500' : 'bg-line',
          )}
        />
      )}
      <span
        className={cn(
          'relative z-10 grid size-8 shrink-0 place-items-center rounded-full transition sm:size-10',
          state === 'done' && 'bg-brand-500 text-white',
          state === 'current' && 'animate-pulse-ring bg-brand-700 text-white',
          state === 'upcoming' && 'border border-line bg-canvas text-navy-400',
        )}
      >
        {state === 'done' ? <Check className="size-4 sm:size-5" strokeWidth={3} /> : Icon && <Icon className="size-4 sm:size-5" />}
      </span>
      <p className={cn('mt-2 w-full text-[10px] leading-tight font-semibold tracking-tight [overflow-wrap:normal] min-[360px]:text-[11px] sm:text-sm sm:tracking-normal', state === 'upcoming' && 'text-navy-400')}>
        {STATUS[status]?.tiny ? (
          <>
            <span className="min-[360px]:hidden">{STATUS[status].tiny}</span>
            <span className="hidden min-[360px]:inline">{label}</span>
          </>
        ) : label}
      </p>
      <p className="mt-0.5 w-full text-[10px] leading-tight text-navy-500 sm:text-xs">
        {state === 'current' ? (
          <span className="font-semibold text-brand-700">Now</span>
        ) : changedAt ? (
          <>
            {formatShortDate(changedAt)}
            <span className="hidden sm:block">{formatTime(changedAt)}</span>
          </>
        ) : (
          <span className="sr-only">Pending</span>
        )}
      </p>
    </li>
  )
}
