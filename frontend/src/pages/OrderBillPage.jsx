import { useParams } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { useOrder } from '../features/orders/hooks/useOrders'
import { BillLines } from '../features/orders/components/OrderBill'
import { Button } from '../components/ui/Button'
import { PageSkeleton } from '../components/ui/Spinner'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { EmptyState } from '../components/feedback/EmptyState'
import { LogoMark } from '../components/navigation/Navbar'
import { formatDate, formatDateTime, formatSlot } from '../utils/formatDate'
import { formatAddress } from '../features/addresses/components/AddressCard'

/** A clean, printable bill. "Print / Save as PDF" uses the browser's print window. */
export default function OrderBillPage() {
  const { orderId } = useParams()
  const { data: order, loading, error, reload } = useOrder(orderId)

  if (loading && !order) return <PageSkeleton />
  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (!order.bill) {
    return (
      <EmptyState
        title="Bill not ready yet"
        description="We'll have your final bill once your clothes are weighed or counted at the laundry."
        action={<Button to={`/customer/orders/${order.id}`}>Back to order</Button>}
      />
    )
  }

  const a = order.addressSnapshot
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" to={`/customer/orders/${order.id}`}><ArrowLeft className="size-4" /> Back to order</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / Save as PDF</Button>
      </div>

      <article className="rounded-2xl border border-line bg-white p-6 sm:p-10 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-extrabold">Wise Laundry</span>
          </div>
          <div className="text-right text-sm">
            <p className="text-lg font-bold">Bill</p>
            <p className="text-navy-500">Order {order.reference}</p>
            <p className="text-navy-500">{formatDate(order.bill.finalizedAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-line py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-navy-500 uppercase">Billed to</p>
            <p className="mt-1 font-semibold">{a.recipientName}</p>
            <p className="text-navy-700">{a.phone}</p>
            <p className="mt-1 text-navy-700">{formatAddress(a)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-navy-500 uppercase">Pickup</p>
            <p className="mt-1 text-navy-700">{formatSlot(order.pickupScheduledAt, order.pickupSlotHours)}</p>
            <p className="mt-3 text-xs font-semibold tracking-wide text-navy-500 uppercase">Bill confirmed</p>
            <p className="mt-1 text-navy-700">{formatDateTime(order.bill.finalizedAt)}</p>
          </div>
        </section>

        <section className="pt-6">
          <BillLines bill={order.bill} />
        </section>

        <footer className="mt-8 text-xs text-navy-500">
          Weight or count confirmed by our staff at the laundry. Questions about this bill? Reply on your order page or contact support.
        </footer>
      </article>
    </div>
  )
}
