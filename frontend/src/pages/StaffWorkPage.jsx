import { useCallback, useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../utils/formatCurrency'
import { ClipboardList, Phone, MapPin, MessageSquareText, RefreshCw, ShieldAlert, PackageCheck, Check, Truck, WashingMachine, AlertTriangle, Scale } from 'lucide-react'
import { api } from '../services/api-client'
import { useAuth } from '../features/auth/hooks/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Spinner'
import { EmptyState } from '../components/feedback/EmptyState'
import { ErrorMessage } from '../components/feedback/ErrorMessage'
import { useToast } from '../components/feedback/Toast'
import { OrderStatusBadge } from '../features/orders/components/OrderStatusBadge'
import { ExpressBadge } from '../features/orders/components/DeliverySpeed'
import { CollectPayment } from '../features/orders/components/Payment'
import { formatSlot, formatDateTime } from '../utils/formatDate'
import { cn } from '../utils/cn'

const REFRESH_MS = 60_000

// Button text for moving an order to each status.
// Steps riders can mark themselves (the server checks this too).
const RIDER_STEPS = ['PICKED_UP', 'RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED']

const ACTION = {
  PICKED_UP: 'Picked up',
  RECEIVED: 'Reached laundry',
  WASHING: 'Start washing',
  IRONING: 'Start ironing',
  READY_FOR_DELIVERY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
}

const GROUPS = [
  { key: 'toPickup', title: 'To pick up', icon: PackageCheck, empty: 'No pickups for this day.' },
  { key: 'atLaundry', title: 'At the laundry', icon: WashingMachine, empty: 'Nothing being washed right now.' },
  { key: 'toDeliver', title: 'To deliver', icon: Truck, empty: 'Nothing out for delivery.' },
]

// India-time date keys for the Today / Tomorrow tabs.
const istKey = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10)

function mapsLink(address) {
  if (address.coordinates?.lat != null) return `https://www.google.com/maps/search/?api=1&query=${address.coordinates.lat},${address.coordinates.lng}`
  const q = [address.line1, address.line2, address.city, address.postalCode].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

function WorkCard({ c, group, index, onAdvance, moving, riders, onAssign, isRider, onPay }) {
  const unit = c.pricingUnit === 'KG' ? 'kg' : 'items'
  // Picking up asks for the weight/count; delivering asks for the customer's code.
  const [asking, setAsking] = useState(false)
  const [value, setValue] = useState('')
  const ask = c.nextStatus === 'DELIVERED'
    ? { label: "Customer's 4-digit code", inputMode: 'numeric', maxLength: 4, pattern: '\\d{4}', placeholder: 'e.g. 4821', submit: 'Confirm delivery', hint: 'Leave empty to hand over without a code (this is noted).' }
    : c.pricingUnit === 'KG'
      ? { label: 'Weight (kg)', type: 'number', inputMode: 'decimal', step: '0.1', min: '0.1', placeholder: 'e.g. 4.5', submit: 'Save & pick up', hint: 'Leave empty to weigh later at the laundry.' }
      : { label: 'Number of items', type: 'number', inputMode: 'numeric', step: '1', min: '1', placeholder: 'e.g. 12', submit: 'Save & pick up', hint: 'Leave empty to count later at the laundry.' }
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Card className={cn('p-4 transition hover:-translate-y-0.5 hover:shadow-md', c.express && 'border-amber-300', c.late && 'border-red-300')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-extrabold">{c.reference}</span>
          {c.express && <ExpressBadge />}
          {c.late && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              <AlertTriangle className="size-3" aria-hidden /> Late
            </span>
          )}
          <span className="ml-auto"><OrderStatusBadge status={c.status} /></span>
        </div>
        <p className="mt-1 text-sm text-navy-500">
          {c.serviceName}
          {c.quantity != null && <> · {c.quantity} {unit}</>}
          {group === 'atLaundry' && !c.billed && <span className="font-semibold text-amber-700"> · not weighed yet</span>}
        </p>

        <p className="mt-3 text-sm font-semibold">
          {group === 'toPickup' ? formatSlot(c.pickupScheduledAt, c.pickupSlotHours) : c.estimatedDeliveryAt ? `Due ${formatDateTime(c.estimatedDeliveryAt)}` : 'Delivery time not set yet'}
        </p>

        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-center gap-2">
            <span className="font-semibold">{c.customer.fullName}</span>
            {c.customer.phone && (
              <a href={`tel:${c.customer.phone}`} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-semibold text-brand-700 hover:bg-brand-50">
                <Phone className="size-3.5" aria-hidden /> {c.customer.phone}
              </a>
            )}
          </p>
          <a href={mapsLink(c.address)} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-navy-700 hover:text-brand-700">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {[c.address.line1, c.address.line2].filter(Boolean).join(', ')}
              {c.address.landmark && ` (near ${c.address.landmark})`}, {c.address.city} {c.address.postalCode}
            </span>
          </a>
          {c.instructions && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900">
              <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden /> {c.instructions}
            </p>
          )}
        </div>

        {asking && (
          <form
            onSubmit={(e) => { e.preventDefault(); onAdvance(c, value.trim() || undefined) }}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-canvas p-3 animate-fade-up"
          >
            <label className="min-w-44 flex-1 text-sm font-medium">
              {ask.label}
              <input
                type={ask.type}
                inputMode={ask.inputMode}
                step={ask.step}
                min={ask.min}
                maxLength={ask.maxLength}
                pattern={ask.pattern}
                required={isRider}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={ask.placeholder}
                className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-base tracking-wide"
              />
            </label>
            <Button type="submit" size="sm" loading={moving}>{ask.submit}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>Cancel</Button>
            {!isRider && <p className="w-full text-xs text-navy-500">{ask.hint}</p>}
          </form>
        )}

        {!asking && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {c.nextStatus && (!isRider || RIDER_STEPS.includes(c.nextStatus)) && (
            c.nextStatus === 'OUT_FOR_DELIVERY' && !c.billed ? (
              <span className="text-xs font-semibold text-amber-700">Weigh & bill before sending out</span>
            ) : (
              <Button size="sm" loading={moving} onClick={() => (['PICKED_UP', 'DELIVERED'].includes(c.nextStatus) ? setAsking(true) : onAdvance(c))}>
                <Check className="size-4" aria-hidden /> {ACTION[c.nextStatus]}
              </Button>
            )
          )}
          {riders && (
            <select
              value={c.rider?.id ?? ''}
              onChange={(e) => onAssign(c, e.target.value || null)}
              aria-label={`Rider for ${c.reference}`}
              className="h-9 max-w-40 rounded-lg border border-line bg-white px-2 text-sm text-navy-700"
            >
              <option value="">No rider</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
            </select>
          )}
          {!isRider && group !== 'toPickup' && (
            <Button to={`/staff/bill?ref=${encodeURIComponent(c.reference)}`} variant="ghost" size="sm" className="ml-auto">
              <Scale className="size-4" aria-hidden /> {c.billed ? 'Check bill' : 'Weigh & bill'}
            </Button>
          )}
        </div>}

        {!asking && c.billed && (
          <div className="mt-3 border-t border-line pt-3"><CollectPayment card={c} onDone={onPay} /></div>
        )}
      </Card>
    </li>
  )
}

/** Staff home: every order that needs work, grouped by what happens next. */
export default function StaffWorkPage() {
  const { user } = useAuth()
  const [day, setDay] = useState(istKey(0))
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(null) // order id being updated
  const toast = useToast()
  const isRider = user?.role === 'RIDER'
  const isStaff = isRider || ['STAFF', 'ADMIN'].includes(user?.role)
  const [riders, setRiders] = useState(null)

  // The day currently on screen, so a slow answer for a previous day is ignored.
  const dayRef = useRef(day)
  dayRef.current = day
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.staffWorkList(day)
      // Ignore a slow answer for a day the user has already switched away from.
      if (dayRef.current === day) setData(res.data)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [day])

  useEffect(() => {
    if (!isStaff) return
    if (!isRider) api.staffRiders().then((r) => setRiders(r.data)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    return () => clearInterval(t)
  }, [load, isStaff, isRider])

  async function advance(c, input) {
    setMoving(c.id)
    try {
      const extra = c.nextStatus === 'DELIVERED' ? { code: input } : { quantity: input }
      const res = await api.staffAdvanceStatus(c.reference, c.status, extra)
      const total = c.nextStatus === 'PICKED_UP' && res.data.bill ? ` · bill ${formatCurrency(res.data.bill.totalPaise)}` : ''
      toast(`${c.reference}: ${ACTION[c.nextStatus]}${total}`)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setMoving(null)
      load()
    }
  }

  function payDone(message, tone = 'success') {
    toast(message, tone)
    load()
  }

  async function assign(c, riderId) {
    try {
      await api.staffAssignRider(c.reference, riderId)
      toast(riderId ? `${c.reference} given to ${riders.find((r) => r.id === riderId)?.fullName}` : `${c.reference}: rider removed`)
    } catch (err) {
      toast(err.message, 'error')
    }
    load()
  }

  if (user && !isStaff) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Staff only"
        description="This page is for Wise Laundry staff. Ask an admin to give your account staff access."
        action={<Button to="/customer">Go to Dashboard</Button>}
      />
    )
  }

  const tabs = [
    { key: istKey(0), label: 'Today' },
    { key: istKey(1), label: 'Tomorrow' },
  ]

  return (
    <>
      <PageHeader
        title={isRider ? 'My jobs' : 'Work list'}
        description={isRider ? 'Pickups and deliveries given to you. Updates every minute.' : "Pickups for the day, what's in the wash, and what's out for delivery. Updates every minute."}
        action={
          <Button variant="secondary" size="sm" onClick={load} loading={loading && Boolean(data)}>
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </Button>
        }
      />

      <div className="mb-5 flex gap-2" role="group" aria-label="Pickup day">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={day === t.key}
            onClick={() => setDay(t.key)}
            className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold transition', day === t.key ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-navy-700 hover:border-navy-400/50')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && !data ? (
        <ErrorMessage error={error} onRetry={load} />
      ) : !data ? (
        <div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {GROUPS.map(({ key, title, icon: Icon, empty }) => {
            const list = data.groups[key]
            return (
              <section key={key} aria-labelledby={`g-${key}`} className="min-w-0">
                <h2 id={`g-${key}`} className="mb-3 flex items-center gap-2 font-bold">
                  <Icon className="size-5 text-brand-700" aria-hidden /> {title}
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-bold text-navy-700">{list.length}</span>
                </h2>
                {list.length ? (
                  <ul className="space-y-3">{list.map((c, i) => <WorkCard key={c.id} c={c} group={key} index={i} onAdvance={advance} moving={moving === c.id} riders={riders} onAssign={assign} isRider={isRider} onPay={payDone} />)}</ul>
                ) : (
                  <Card className="p-5 text-sm text-navy-500"><ClipboardList className="mb-2 size-5 text-navy-400" aria-hidden />{empty}</Card>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
