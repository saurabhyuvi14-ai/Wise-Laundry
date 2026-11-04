import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react'
import { useOrders } from '../features/orders/hooks/useOrders'
import { OrderList } from '../features/orders/components/OrderList'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Spinner'
import { EmptyState } from '../components/feedback/EmptyState'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { cn } from '../utils/cn'

const PAGE_SIZE = 5
const tabs = [
  { key: 'active', label: 'Active' },
  { key: 'past', label: 'Past' },
]

export default function MyOrdersPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'past' ? 'past' : 'active'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const list = useOrders({ status: tab, page, pageSize: PAGE_SIZE })
  const activeCount = useOrders({ status: 'active', pageSize: 1 })
  const pastCount = useOrders({ status: 'past', pageSize: 1 })
  const counts = { active: activeCount.meta?.total, past: pastCount.meta?.total }

  const total = list.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader title="My Orders" description="View and manage your laundry orders." badge={<DemoBadge />} />

      <Card className="animate-fade-up">
        <div role="tablist" aria-label="Order status" className="flex gap-6 border-b border-line px-5 sm:px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setParams({ tab: t.key })}
              className={cn(
                '-mb-px border-b-2 py-4 text-sm font-semibold transition',
                tab === t.key ? 'border-brand-700 text-brand-700' : 'border-transparent text-navy-500 hover:text-navy-900',
              )}
            >
              {t.label}
              {counts[t.key] != null && (
                <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs', tab === t.key ? 'bg-brand-50' : 'bg-canvas')}>{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="p-2 sm:p-3">
          {list.loading ? (
            <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : list.error ? (
            <ErrorMessage error={list.error} onRetry={list.reload} />
          ) : list.data.length ? (
            <OrderList orders={list.data} />
          ) : (
            <EmptyState
              icon={PackageOpen}
              title={tab === 'active' ? 'No active orders' : 'No past orders yet'}
              description={tab === 'active' ? 'Book a pickup from your Dashboard.' : 'Delivered and cancelled orders appear here.'}
              action={tab === 'active' && <Button to="/customer" size="sm" variant="secondary">Go to Dashboard</Button>}
            />
          )}
        </div>

        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm sm:px-6">
            <span className="text-navy-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setParams({ tab, page: page - 1 })} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setParams({ tab, page: page + 1 })} aria-label="Next page"><ChevronRight className="size-4" /></Button>
            </div>
          </nav>
        )}
      </Card>
    </>
  )
}
