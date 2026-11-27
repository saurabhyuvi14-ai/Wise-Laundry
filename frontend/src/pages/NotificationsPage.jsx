import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, CalendarClock, ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { PushToggle } from '../features/notifications/components/PushToggle'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Spinner'
import { EmptyState } from '../components/feedback/EmptyState'
import { useNotifications, notificationText } from '../context/NotificationsContext'
import { STATUS } from '../features/orders/components/OrderStatusBadge'
import { formatSlot, formatTime, formatShortDate } from '../utils/formatDate'
import { cn } from '../utils/cn'

function dayGroup(iso) {
  const d = new Date(iso)
  const today = new Date()
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(today) - start(d)) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier'
}

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (dayGroup(iso) === 'Today') return formatTime(iso)
  return `${formatShortDate(iso)}, ${formatTime(iso)}`
}

export default function NotificationsPage() {
  const { items, loading, reload, markSeen } = useNotifications()
  // Remember which ones were unread when the page opened, so they stay highlighted while you read.
  const unreadOnOpen = useRef(null)
  if (!loading && unreadOnOpen.current === null) unreadOnOpen.current = new Set(items.filter((n) => n.unread).map((n) => n.id))

  useEffect(() => { reload() }, [reload])
  useEffect(() => { if (!loading) markSeen() }, [loading, items.length, markSeen])

  const groups = ['Today', 'Yesterday', 'Earlier']
    .map((g) => [g, items.filter((n) => dayGroup(n.at) === g)])
    .filter(([, list]) => list.length)

  let i = 0
  return (
    <>
      <PageHeader title="Updates" description="Every step of your orders, newest first." />
      <PushToggle />
      {loading && !items.length ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-20 rounded-2xl" />)}</div>
      ) : !items.length ? (
        <Card><EmptyState icon={BellOff} title="No updates yet" description="When your laundry is picked up, washed or delivered, you'll see it here." /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, list]) => (
            <section key={label}>
              <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-navy-500 uppercase">{label}</h2>
              <Card className="overflow-hidden p-1.5">
                <ul>
                  {list.map((n) => {
                    const Icon = n.kind === 'RESCHEDULED' ? CalendarClock : STATUS[n.status]?.icon
                    const fresh = unreadOnOpen.current?.has(n.id)
                    return (
                      <li key={n.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i++, 10) * 35}ms` }}>
                        <Link
                          to={`/customer/orders/${n.orderId}/tracking`}
                          className={cn('group flex items-center gap-3.5 rounded-xl px-3 py-3 transition hover:bg-canvas', fresh && 'bg-brand-50/60')}
                        >
                          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', n.status === 'CANCELLED' ? 'bg-red-50 text-red-600' : n.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700')}>
                            {Icon && <Icon className="size-5" aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-bold">
                              {n.reference}{n.serviceName && <span className="truncate font-medium text-navy-500">· {n.serviceName}</span>}
                              {fresh && <span className="size-2 shrink-0 rounded-full bg-brand-500" aria-label="New" />}
                            </span>
                            <span className="block text-sm text-navy-700">
                              {n.kind === 'RESCHEDULED' && n.to ? `Pickup moved to ${formatSlot(n.to)}.` : notificationText(n)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs text-navy-500">{ago(n.at)}</span>
                          <ChevronRight className="size-4 shrink-0 text-navy-400 transition group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
