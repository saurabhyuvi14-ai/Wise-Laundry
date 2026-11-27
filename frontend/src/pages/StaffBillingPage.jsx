import { useState } from 'react'
import { Search, Scale, ShieldAlert } from 'lucide-react'
import { api } from '../services/api-client'
import { useAuth } from '../features/auth/hooks/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/feedback/EmptyState'
import { useToast } from '../components/feedback/Toast'
import { OrderStatusBadge } from '../features/orders/components/OrderStatusBadge'
import { BillLines } from '../features/orders/components/OrderBill'
import { formatCurrency, UNIT_LABEL } from '../utils/formatCurrency'
import { formatSlot } from '../utils/formatDate'
import { ExpressBadge } from '../features/orders/components/DeliverySpeed'

const unitWord = { KG: 'kg', PIECE: 'items' }

/** Staff only: look up an order by number, enter the weight or count, save the final bill. */
export default function StaffBillingPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [ref, setRef] = useState('')
  const [order, setOrder] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user && !['STAFF', 'ADMIN'].includes(user.role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Staff only"
        description="This page is for Wise Laundry staff. Ask an admin to give your account staff access."
        action={<Button to="/customer">Go to Dashboard</Button>}
      />
    )
  }

  async function find(e) {
    e.preventDefault()
    if (!ref.trim()) return setError('Enter an order number, like WL-1001.')
    setBusy(true)
    setError(null)
    try {
      const res = await api.staffGetOrder(ref.trim())
      setOrder(res.data)
      setQuantity(res.data.items[0].quantity ?? '')
    } catch (err) {
      setOrder(null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.staffSaveBill(order.reference, { quantity: Number(quantity) })
      setOrder(res.data)
      toast(`Bill saved: ${formatCurrency(res.data.bill.totalPaise)}`)
    } catch (err) {
      setError(err.fields?.quantity || err.message)
    } finally {
      setBusy(false)
    }
  }

  const item = order?.items[0]
  const preview = item && Number(quantity) > 0 ? Math.round(Number(quantity) * item.unitPricePaise) : null

  return (
    <>
      <PageHeader title="Weigh & bill" description="Enter the weight or count after pickup. The customer sees the bill right away." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardBody>
              <form onSubmit={find} className="flex items-end gap-2">
                <Input className="flex-1" label="Order number" placeholder="WL-1001" value={ref} onChange={(e) => setRef(e.target.value)} autoCapitalize="characters" />
                <Button type="submit" loading={busy && !order}><Search className="size-4" /> Find</Button>
              </form>
              {error && !order && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
            </CardBody>
          </Card>

          {order && (
            <Card>
              <CardHeader icon={Scale} title={`${order.reference} · ${item.serviceName}`} />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <OrderStatusBadge status={order.currentStatus} />
                  {order.express && <ExpressBadge />}
                  <span className="text-navy-500">{order.customer?.fullName} · {order.customer?.phone}</span>
                </div>
                <p className="text-sm text-navy-500">Pickup: {formatSlot(order.pickupScheduledAt, order.pickupSlotHours)} · Rate {formatCurrency(item.unitPricePaise)} {UNIT_LABEL[item.pricingUnit]}</p>

                {order.canBill ? (
                  <form onSubmit={save} className="space-y-3">
                    <Input
                      label={item.pricingUnit === 'PIECE' ? 'Number of items' : 'Weight (kg)'}
                      type="number"
                      inputMode="decimal"
                      step={item.pricingUnit === 'PIECE' ? 1 : 0.1}
                      min={item.pricingUnit === 'PIECE' ? 1 : 0.1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      error={error}
                      hint={preview != null ? `${quantity} ${unitWord[item.pricingUnit]} × rate = ${formatCurrency(preview)}${order.express ? ` + ${order.express.surchargePercent}% express = ${formatCurrency(Math.round(preview * (1 + order.express.surchargePercent / 100)))}` : ''} (before any other extras)` : undefined}
                    />
                    <Button type="submit" loading={busy}>{order.bill ? 'Update bill' : 'Save bill'}</Button>
                  </form>
                ) : (
                  <p className="rounded-xl bg-canvas px-3.5 py-2.5 text-sm text-navy-700">
                    {order.currentStatus === 'BOOKED' ? 'Not picked up yet. You can bill it after pickup.' : 'This order can no longer be billed.'}
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {order?.bill && (
          <Card className="h-fit">
            <CardHeader title="Saved bill" />
            <CardBody className="pt-3"><BillLines bill={order.bill} /></CardBody>
          </Card>
        )}
      </div>
    </>
  )
}
