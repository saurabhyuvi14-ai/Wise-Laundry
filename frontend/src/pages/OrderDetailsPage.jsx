import { useParams } from 'react-router-dom'
import { MapPin, CalendarDays, Receipt, MessageSquareText, ArrowRight, Headset } from 'lucide-react'
import { useOrder } from '../features/orders/hooks/useOrders'
import { OrderStatusBadge, STATUS, stageLabel } from '../features/orders/components/OrderStatusBadge'
import { ServiceIcon } from '../features/services/components/ServiceCard'
import { useServices } from '../features/services/components/ServiceList'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageSkeleton } from '../components/ui/Spinner'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { formatCurrency, UNIT_LABEL } from '../utils/formatCurrency'
import { formatDate, formatDateTime, formatSlot } from '../utils/formatDate'
import { ADDRESS_LABELS, formatAddress } from '../features/addresses/components/AddressCard'

const unitWord = { KG: 'kg', PIECE: 'items' }

export default function OrderDetailsPage() {
  const { orderId } = useParams()
  const { data: order, loading, error, reload } = useOrder(orderId)
  const services = useServices()

  if (loading) return <PageSkeleton />
  if (error) return <ErrorMessage error={error} onRetry={reload} />

  const item = order.items[0]
  const service = services.data?.find((s) => s.id === item.serviceId)
  const a = order.addressSnapshot
  const cancelled = order.currentStatus === 'CANCELLED'

  return (
    <>
      <PageHeader
        back={{ to: '/customer/orders', label: 'My Orders' }}
        title={`Order ${order.reference}`}
        description={`Placed on ${formatDate(order.createdAt)}`}
        badge={<><OrderStatusBadge status={order.currentStatus} label={stageLabel(order.currentStatus, service)} /><DemoBadge /></>}
        action={!cancelled && <Button to={`/customer/orders/${order.id}/tracking`}>Track live <ArrowRight className="size-4" /></Button>}
      />

      <div className="grid animate-fade-up gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card className="flex items-center gap-4 border-brand-200 bg-brand-50/40 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
              {(() => { const I = STATUS[order.currentStatus]?.icon; return I && <I className="size-5" /> })()}
            </span>
            <div>
              <p className="font-bold">{stageLabel(order.currentStatus, service)}</p>
              <p className="text-sm text-navy-700">{STATUS[order.currentStatus]?.message} <span className="text-navy-500">· Updated {formatDateTime(order.updatedAt)}</span></p>
            </div>
          </Card>

          <Card>
            <CardHeader icon={Receipt} title="Items & price" />
            <CardBody>
              <div className="flex items-center gap-4 rounded-xl border border-line p-4">
                <span className="grid size-11 place-items-center rounded-xl bg-canvas text-navy-700"><ServiceIcon name={item.serviceName} /></span>
                <div className="flex-1">
                  <p className="font-bold">{item.serviceName}</p>
                  <p className="text-sm text-navy-500">{formatCurrency(item.unitPricePaise)} {UNIT_LABEL[item.pricingUnit]}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-navy-500">Quantity</p>
                  <p className="font-semibold">{item.quantity != null ? `${item.quantity} ${unitWord[item.pricingUnit]}` : 'At pickup'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-line pt-4">
                <span className="font-semibold">Total</span>
                {order.totalPaise != null ? (
                  <span className="text-xl font-extrabold">{formatCurrency(order.totalPaise)}</span>
                ) : (
                  <span className="text-sm font-medium text-navy-500">{cancelled ? 'No charge' : 'Confirmed after collection'}</span>
                )}
              </div>
            </CardBody>
          </Card>

          {order.instructions && (
            <Card>
              <CardHeader icon={MessageSquareText} title="Pickup instructions" />
              <CardBody><p className="text-sm text-navy-700">“{order.instructions}”</p></CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={CalendarDays} title="Pickup" />
            <CardBody className="pt-3">
              <p className="font-semibold">{formatSlot(order.pickupScheduledAt, order.pickupSlotHours)}</p>
              <p className="text-xs text-navy-500">Requested window · IST</p>
              <p className="mt-4 text-sm text-navy-500">Estimated delivery</p>
              <p className="font-semibold">{order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : 'Not estimated yet'}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={MapPin} title={`${ADDRESS_LABELS[a.label] ?? 'Address'}`} />
            <CardBody className="pt-3 text-sm">
              <p className="font-semibold">{a.recipientName} · {a.phone}</p>
              <p className="mt-1 text-navy-700">{formatAddress(a)}</p>
              {a.landmark && <p className="mt-1 text-navy-500">Landmark: {a.landmark}</p>}
            </CardBody>
          </Card>
          <Card className="flex items-center gap-3 p-5">
            <Headset className="size-5 text-brand-700" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Need help with this order?</p>
              <a href="mailto:support@wiselaundry.example" className="font-semibold text-brand-700 hover:underline">Contact support</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
