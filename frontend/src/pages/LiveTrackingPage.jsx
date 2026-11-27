import { Link, Navigate, useParams } from 'react-router-dom'
import { RotateCw, Headset, WifiOff, History, MapPin } from 'lucide-react'
import { useTracking, useOrders } from '../features/orders/hooks/useOrders'
import { TrackingTimeline } from '../features/tracking/components/TrackingTimeline'
import { DeliveryEstimate } from '../features/tracking/components/DeliveryEstimate'
import { useServices } from '../features/services/components/ServiceList'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { OrderSwitcher } from '../features/tracking/components/OrderSwitcher'
import { PageSkeleton } from '../components/ui/Spinner'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { EmptyState } from '../components/feedback/EmptyState'
import { Button } from '../components/ui/Button'
import { STATUS, stageLabel } from '../features/orders/components/OrderStatusBadge'
import { formatDateTime, formatRelative } from '../utils/formatDate'
import { cn } from '../utils/cn'

/** /customer/tracking — opens the most recently updated active order, or explains there is nothing to track. */
export function TrackingLatest() {
  const { data, loading, error, reload } = useOrders({ status: 'active', pageSize: 50 })
  if (loading) return <PageSkeleton />
  if (error) return <ErrorMessage error={error} onRetry={reload} />
  const latest = [...(data ?? [])].sort((a, b) => {
    const rank = (o) => (o.currentStatus === 'BOOKED' ? 1 : 0) // prefer orders already in progress
    return rank(a) - rank(b) || new Date(b.updatedAt) - new Date(a.updatedAt)
  })[0]
  if (latest) return <Navigate to={`/customer/orders/${latest.id}/tracking`} replace />
  return (
    <>
      <PageHeader title="Live Tracking" description="Track your laundry in real time." />
      <Card>
        <EmptyState
          icon={MapPin}
          title="Nothing to track right now"
          description="You have no active orders. Past orders can still be opened from My Orders."
          action={<Button to="/customer/orders" variant="secondary" size="sm">Go to My Orders</Button>}
        />
      </Card>
    </>
  )
}

export default function LiveTrackingPage() {
  const { orderId } = useParams()
  const tracking = useTracking(orderId)
  const services = useServices()
  const orders = useOrders({ status: 'all', pageSize: 50 })

  if (tracking.loading) return <PageSkeleton />
  if (tracking.error && !tracking.data) return <ErrorMessage error={tracking.error} onRetry={tracking.refresh} />

  const t = tracking.data
  const service = services.data?.find((s) => s.id === t.serviceId)
  const Icon = STATUS[t.currentStatus]?.icon
  const done = t.currentStatus === 'DELIVERED'
  const delivered = t.history.find((h) => h.status === 'DELIVERED')

  return (
    <>
      <PageHeader title="Live Tracking" description="Track your laundry in real time." />

      <div className="animate-fade-up space-y-5">
        {orders.data?.length > 1 && <OrderSwitcher orders={orders.data} currentId={t.orderId ?? orderId} services={services.data} />}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-3 text-xs text-navy-500">
            {tracking.error ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700"><WifiOff className="size-3.5" /> Couldn't refresh — showing last update</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-brand-500" /></span>
                Updated {formatRelative(tracking.lastSuccess)}
              </span>
            )}
            <button onClick={tracking.refresh} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-navy-700 hover:bg-white" aria-label="Refresh tracking">
              <RotateCw className="size-3.5" /> Refresh
            </button>
          </div>
        </div>

        <Card className={cn('flex items-center gap-5 p-5 sm:p-6', t.currentStatus === 'CANCELLED' ? 'bg-red-50/50' : 'border-brand-200 bg-gradient-to-r from-brand-50 to-white')}>
          <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', t.currentStatus === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-white text-brand-700 ring-1 ring-brand-200')}>
            {Icon && <Icon className="size-7" />}
          </span>
          <div className="min-w-0 border-l border-brand-200/70 pl-5">
            <p className="text-sm font-semibold text-navy-500">{t.reference} · {stageLabel(t.currentStatus, service)}</p>
            <p className="text-lg font-extrabold sm:text-xl">{STATUS[t.currentStatus]?.message}</p>
          </div>
        </Card>

        <Card className="px-1 py-5 min-[360px]:px-2 sm:px-8 sm:py-8">
          <TrackingTimeline service={service} history={t.history} currentStatus={t.currentStatus} />
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <DeliveryEstimate estimatedDeliveryAt={t.estimatedDeliveryAt} delivered={done} deliveredAt={delivered?.changedAt} />
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas text-navy-700"><Headset className="size-5" /></span>
            <div>
              <p className="text-sm text-navy-500">Need help with this order?</p>
              <Link to={`/customer/help?order=${encodeURIComponent(t.reference)}`} className="font-bold text-brand-700 hover:underline">Get help</Link>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader icon={History} title="Activity" description="Every update on your order, newest first." />
          <CardBody>
            <ol className="space-y-4">
              {[...t.history].reverse().map((h, i) => (
                <li key={h.status + h.changedAt} className="flex gap-3">
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', i === 0 ? 'bg-brand-500 ring-4 ring-brand-100' : 'bg-navy-400/50')} aria-hidden />
                  <div className="flex-1 text-sm">
                    <p className="flex flex-wrap justify-between gap-x-3">
                      <span className="font-semibold">{stageLabel(h.status, service)}</span>
                      <time className="text-navy-500" dateTime={h.changedAt}>{formatDateTime(h.changedAt)}</time>
                    </p>
                    {h.note && <p className="text-navy-500">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

      </div>
    </>
  )
}
