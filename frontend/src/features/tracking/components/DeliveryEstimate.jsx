import { CalendarClock } from 'lucide-react'
import { formatDate, formatTime } from '../../../utils/formatDate'

export function DeliveryEstimate({ estimatedDeliveryAt, delivered, deliveredAt }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <CalendarClock className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm text-navy-500">{delivered ? 'Delivered on' : 'Estimated delivery'}</p>
        {delivered ? (
          <p className="text-lg font-bold">{formatDate(deliveredAt)}</p>
        ) : estimatedDeliveryAt ? (
          <>
            <p className="text-lg font-bold">{formatDate(estimatedDeliveryAt)}</p>
            <p className="text-xs text-navy-500">By {formatTime(estimatedDeliveryAt)} IST</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold">Not estimated yet</p>
            <p className="text-xs text-navy-500">We'll share it once your items are counted.</p>
          </>
        )}
      </div>
    </div>
  )
}
