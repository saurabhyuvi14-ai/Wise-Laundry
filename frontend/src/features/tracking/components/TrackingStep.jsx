import { Check } from 'lucide-react'
import { STATUS } from '../../orders/components/OrderStatusBadge'
import { formatShortDate, formatTime } from '../../../utils/formatDate'
import { cn } from '../../../utils/cn'

/** state: 'done' | 'current' | 'upcoming' */
export function TrackingStep({ status, label, state, changedAt, isLast }) {
  const Icon = STATUS[status]?.icon
  return (
    <li className="relative flex flex-1 gap-4 pb-6 last:pb-0 md:flex-col md:items-center md:gap-0 md:pb-0 md:text-center">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            'absolute top-10 left-[19px] h-[calc(100%-2.5rem)] w-0.5 md:top-[19px] md:left-[calc(50%+1.5rem)] md:h-0.5 md:w-[calc(100%-3rem)]',
            state === 'done' ? 'bg-brand-500' : 'bg-line',
          )}
        />
      )}
      <span
        className={cn(
          'relative z-10 grid size-10 shrink-0 place-items-center rounded-full transition',
          state === 'done' && 'bg-brand-500 text-white',
          state === 'current' && 'animate-pulse-ring bg-brand-700 text-white',
          state === 'upcoming' && 'border border-line bg-canvas text-navy-400',
        )}
      >
        {state === 'done' ? <Check className="size-5" strokeWidth={3} /> : Icon && <Icon className="size-5" />}
      </span>
      <div className="pt-1.5 md:pt-3">
        <p className={cn('text-sm font-semibold', state === 'upcoming' && 'text-navy-500')}>{label}</p>
        <p className="mt-0.5 text-xs text-navy-500">
          {state === 'current' ? 'In progress' : changedAt ? (
            <>{formatShortDate(changedAt)}<span className="md:hidden"> · </span><span className="md:block">{formatTime(changedAt)}</span></>
          ) : 'Pending'}
        </p>
      </div>
    </li>
  )
}
