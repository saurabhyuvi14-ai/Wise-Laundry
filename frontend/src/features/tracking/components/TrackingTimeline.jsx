import { TrackingStep } from './TrackingStep'
import { stepLabel } from '../../orders/components/OrderStatusBadge'

/** Horizontal stepper built from the service's stages + the real history (not array position). */
export function TrackingTimeline({ service, history, currentStatus }) {
  const reached = new Map(history.map((h) => [h.status, h.changedAt]))
  const stages = service?.stages ?? history.map((h) => h.status)
  const cancelled = currentStatus === 'CANCELLED'
  const visible = cancelled ? history.map((h) => h.status) : stages
  const currentIdx = visible.indexOf(currentStatus)

  return (
    <ol className="flex w-full items-start" aria-label="Order progress">
      {visible.map((status, i) => {
        let state = 'upcoming'
        if (!cancelled && currentIdx >= 0) {
          // Every step before the current one is finished, even if a step was skipped in the history.
          if (i < currentIdx || currentStatus === 'DELIVERED') state = 'done'
          else if (i === currentIdx) state = 'current'
        } else if (reached.has(status)) {
          state = status === currentStatus && currentStatus !== 'DELIVERED' && !cancelled ? 'current' : 'done'
        }
        return (
          <TrackingStep
            key={status}
            status={status}
            label={stepLabel(status, service)}
            state={state}
            changedAt={reached.get(status)}
            isLast={i === visible.length - 1}
          />
        )
      })}
    </ol>
  )
}
