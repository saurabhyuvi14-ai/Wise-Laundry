import { Printer, ReceiptText } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatDateTime } from '../../../utils/formatDate'

/** The final bill lines and total, shown once staff have weighed or counted the clothes. */
export function BillLines({ bill }) {
  return (
    <div>
      <ul className="divide-y divide-line">
        {bill.lines.map((line, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="font-semibold">{line.label}</p>
              {line.detail && <p className="text-sm text-navy-500">{line.detail}</p>}
            </div>
            <p className="shrink-0 font-semibold tabular-nums">{line.amountPaise === 0 ? 'Free' : formatCurrency(line.amountPaise)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t-2 border-navy-900 pt-3">
        <span className="font-bold">Total</span>
        <span className="text-xl font-extrabold tabular-nums">{formatCurrency(bill.totalPaise)}</span>
      </div>
    </div>
  )
}

/** Bill card on the order page: the bill, when it was confirmed, and a link to print it. */
export function OrderBill({ order }) {
  const { bill } = order
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
        <ReceiptText className="size-4 shrink-0" aria-hidden />
        <span>
          Final bill confirmed {formatDateTime(bill.finalizedAt)}
          {bill.revision > 1 && ' (updated)'}
        </span>
      </div>
      <BillLines bill={bill} />
      <Button variant="secondary" size="sm" to={`/customer/orders/${order.id}/bill`}>
        <Printer className="size-4" aria-hidden /> View / print bill
      </Button>
    </div>
  )
}
