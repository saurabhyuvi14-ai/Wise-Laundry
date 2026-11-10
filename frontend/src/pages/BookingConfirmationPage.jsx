import { useParams } from 'react-router-dom'
import { Check, PackageCheck, Scale, MapPin, ArrowRight } from 'lucide-react'
import { useOrder } from '../features/orders/hooks/useOrders'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageSkeleton } from '../components/ui/Spinner'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { formatSlot } from '../utils/formatDate'
import { formatAddress } from '../features/addresses/components/AddressCard'

const nextSteps = [
  { icon: PackageCheck, title: 'We pick up', text: 'Our partner arrives in your requested window. Just hand over the bag.' },
  { icon: Scale, title: 'We weigh & count', text: 'Final quantity and price are confirmed after collection.' },
  { icon: MapPin, title: 'Track every stage', text: 'Follow every step, from pickup to delivery, in Live Tracking.' },
]

export default function BookingConfirmationPage() {
  const { orderId } = useParams()
  const { data: order, loading, error, reload } = useOrder(orderId) // fetched by id so refresh works

  if (loading) return <PageSkeleton />
  if (error) return <ErrorMessage error={error} onRetry={reload} />

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden text-center">
        <div className="relative bg-gradient-to-b from-brand-50 to-white px-6 pt-10 pb-6">
          <span className="mx-auto grid size-16 animate-pop place-items-center rounded-full bg-brand-700 text-white shadow-lift">
            <Check className="size-8" strokeWidth={3} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Pickup booked!</h1>
          <p className="mt-1 text-navy-500">Your order reference is</p>
          <p className="mt-2 inline-block rounded-xl bg-white px-4 py-1.5 text-xl font-extrabold tracking-wide ring-1 ring-line">{order.reference}</p>
          <div className="mt-3"><DemoBadge /></div>
        </div>

        <dl className="grid gap-px border-y border-line bg-line text-left sm:grid-cols-3">
          {[
            ['Service', order.items[0].serviceName],
            ['Pickup', formatSlot(order.pickupScheduledAt, order.pickupSlotHours)],
            ['Address', formatAddress(order.addressSnapshot)],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-5 py-4">
              <dt className="text-xs font-medium text-navy-500">{k}</dt>
              <dd className="mt-1 text-sm font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="px-6 py-6 text-left">
          <h2 className="text-sm font-bold text-navy-700">What happens next</h2>
          <ol className="mt-4 space-y-4">
            {nextSteps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex animate-fade-up gap-3" style={{ animationDelay: `${200 + i * 100}ms` }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-4" /></span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-navy-500">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-2 border-t border-line bg-canvas/60 px-6 py-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" to="/customer">Back to Dashboard</Button>
          <Button variant="secondary" to={`/customer/orders/${order.id}`}>View details</Button>
          <Button to={`/customer/orders/${order.id}/tracking`}>Track order <ArrowRight className="size-4" /></Button>
        </div>
      </Card>
    </div>
  )
}
