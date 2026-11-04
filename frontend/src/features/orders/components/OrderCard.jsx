import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { OrderStatusBadge } from './OrderStatusBadge'
import { ServiceIcon } from '../../services/components/ServiceCard'
import { formatShortDate, formatDate } from '../../../utils/formatDate'
import { formatCurrency } from '../../../utils/formatCurrency'

/** One order row. Uses the DB id in the URL and the friendly reference for display. */
export function OrderCard({ order }) {
  const item = order.items[0]
  return (
    <Link
      to={`/customer/orders/${order.id}`}
      className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition hover:bg-canvas sm:px-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <ServiceIcon name={item.serviceName} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-bold">
          {order.reference}
          <span className="hidden text-sm font-medium text-navy-500 sm:inline">· {item.serviceName}</span>
        </p>
        <p className="mt-0.5 truncate text-sm text-navy-500">
          <span className="sm:hidden">{item.serviceName} · </span>
          <span className="sm:hidden">{formatShortDate(order.pickupScheduledAt)}</span>
          <span className="hidden sm:inline">{formatDate(order.pickupScheduledAt)}</span>
        </p>
      </div>
      <div className="hidden w-24 text-right text-sm font-semibold md:block">
        {order.totalPaise != null ? formatCurrency(order.totalPaise) : <span className="font-normal text-navy-400">Pending</span>}
      </div>
      <div className="flex shrink-0 justify-end sm:w-32">
        <OrderStatusBadge status={order.currentStatus} />
      </div>
      <ChevronRight className="size-4 shrink-0 text-navy-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden />
    </Link>
  )
}
