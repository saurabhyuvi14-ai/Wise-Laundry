import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, PackageOpen, Sparkles } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth'
import { useOrders } from '../features/orders/hooks/useOrders'
import { OrderList } from '../features/orders/components/OrderList'
import { OrderStatusBadge, STATUS, isActive, stageLabel } from '../features/orders/components/OrderStatusBadge'
import { BookPickupButton } from '../features/orders/components/BookPickupButton'
import { useServices } from '../features/services/components/ServiceList'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Spinner'
import { EmptyState } from '../components/feedback/EmptyState'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { formatDate, formatSlot } from '../utils/formatDate'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function ActiveOrderCard({ order, service }) {
  if (!order) {
    return (
      <Card className="flex flex-col justify-center p-6">
        <p className="text-sm font-medium text-navy-500">Active order</p>
        <p className="mt-2 text-lg font-bold">Nothing in the wash</p>
        <p className="mt-1 text-sm text-navy-500">Book a pickup and track it here.</p>
      </Card>
    )
  }
  const stages = service?.stages ?? []
  const idx = Math.max(0, stages.indexOf(order.currentStatus))
  const pct = stages.length ? ((idx + 1) / stages.length) * 100 : 0

  return (
    <Card className="relative overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50/80 to-white p-6">
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-navy-500">Active order</p>
            <p className="mt-1 text-xl font-extrabold">Order {order.reference}</p>
          </div>
          <OrderStatusBadge status={order.currentStatus} label={stageLabel(order.currentStatus, service)} />
        </div>
        <p className="mt-2 text-sm text-navy-700">{STATUS[order.currentStatus]?.message}</p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-brand-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Order progress">
          <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-navy-500">Step {idx + 1} of {stages.length}</span>
          <Link to={`/customer/orders/${order.id}/tracking`} className="inline-flex items-center gap-1 font-bold text-brand-700 hover:gap-2 transition-all">
            Track live <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </Card>
  )
}

function NextPickupCard({ order }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-navy-500">
        <CalendarDays className="size-4" aria-hidden /> Next pickup
      </div>
      {order ? (
        <>
          <p className="mt-3 text-xl font-extrabold">{formatDate(order.pickupScheduledAt, { year: undefined })}</p>
          <p className="mt-1 text-sm text-navy-500">Requested window {formatSlot(order.pickupScheduledAt, order.pickupSlotHours).split(', ')[1]}</p>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
            <span className="font-semibold">{order.reference} · {order.items[0].serviceName}</span>
            <Link to={`/customer/orders/${order.id}`} className="font-bold text-brand-700 hover:underline">Details</Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-lg font-bold">No pickup scheduled</p>
          <p className="mt-1 text-sm text-navy-500">Your next pickup will show up here.</p>
        </>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const orders = useOrders({ status: 'all', pageSize: 50 })
  const services = useServices()

  const list = orders.data ?? []
  const active = list.filter((o) => isActive(o.currentStatus))
  const inProgress = [...active].filter((o) => o.currentStatus !== 'BOOKED').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] ?? active[0]
  const nextPickup = active
    .filter((o) => o.currentStatus === 'BOOKED' && new Date(o.pickupScheduledAt) > new Date())
    .sort((a, b) => new Date(a.pickupScheduledAt) - new Date(b.pickupScheduledAt))[0]
  const serviceOf = (o) => services.data?.find((s) => s.id === o?.items[0].serviceId)

  return (
    <>
      <header className="mb-8 flex animate-fade-up flex-wrap items-center justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-navy-500">{greeting()} <DemoBadge /></p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">Hi, {user.fullName.split(' ')[0]}</h1>
          <p className="text-navy-500">Welcome to Wise Laundry</p>
        </div>
        <BookPickupButton />
      </header>

      {orders.error ? (
        <ErrorMessage error={orders.error} onRetry={orders.reload} />
      ) : (
        <div className="space-y-5">
          <div className="grid animate-fade-up gap-5 md:grid-cols-2" style={{ animationDelay: '60ms' }}>
            {orders.loading ? (
              <><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></>
            ) : (
              <>
                <ActiveOrderCard order={inProgress} service={serviceOf(inProgress)} />
                <NextPickupCard order={nextPickup} />
              </>
            )}
          </div>

          <div className="grid animate-fade-up grid-cols-3 gap-3 sm:gap-5" style={{ animationDelay: '120ms' }}>
            {[
              ['Active', active.length],
              ['Completed', list.filter((o) => o.currentStatus === 'DELIVERED').length],
              ['Total orders', list.length],
            ].map(([label, value]) => (
              <Card key={label} className="px-4 py-4 sm:px-6">
                <p className="text-xs font-medium text-navy-500 sm:text-sm">{label}</p>
                <p className="mt-1 text-2xl font-extrabold">{orders.loading ? '–' : value}</p>
              </Card>
            ))}
          </div>

          <Card className="animate-fade-up" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 className="font-bold">Recent orders</h2>
              <Link to="/customer/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                View all <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="p-2 sm:p-3">
              {orders.loading ? (
                <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : list.length ? (
                <OrderList orders={list.slice(0, 3)} />
              ) : (
                <EmptyState icon={PackageOpen} title="No orders yet" description="Your first pickup is one tap away." />
              )}
            </div>
          </Card>

          {!orders.loading && list.length === 0 && (
            <p className="flex items-center justify-center gap-2 text-sm text-navy-500">
              <Sparkles className="size-4 text-brand-500" /> Tip: save your address in Profile to book faster.
            </p>
          )}
        </div>
      )}
    </>
  )
}
