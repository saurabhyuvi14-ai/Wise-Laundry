import { TrackingStep } from './TrackingStep'
import { stageLabel } from '../../orders/components/OrderStatusBadge'

/** Builds the stepper from the service's stages + the real history (not array position). */
export function TrackingTimeline({ service, history, currentStatus }) {
  const reached = new Map(history.map((h) => [h.status, h.changedAt]))
  const stages = service?.stages ?? history.map((h) => h.status)
  const cancelled = currentStatus === 'CANCELLED'
  const visible = cancelled ? history.map((h) => h.status) : stages

  return (
    <ol className="flex flex-col md:flex-row" aria-label="Order progress">
      {visible.map((status, i) => {
        let state = 'upcoming'
        if (reached.has(status)) state = status === currentStatus && currentStatus !== 'DELIVERED' && !cancelled ? 'current' : 'done'
        return (
          <TrackingStep
            key={status}
            status={status}
            label={stageLabel(status, service)}
            state={state}
            changedAt={reached.get(status)}
            isLast={i === visible.length - 1}
          />
        )
      })}
    </ol>
  )
}
