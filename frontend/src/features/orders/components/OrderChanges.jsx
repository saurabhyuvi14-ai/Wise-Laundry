import { useState } from 'react'
import { CalendarClock, XCircle, Clock3, Ban } from 'lucide-react'
import { api } from '../../../services/api-client'
import { Card, CardHeader, CardBody } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { Textarea } from '../../../components/ui/Input'
import { formatDateTime, formatSlot } from '../../../utils/formatDate'
import { cn } from '../../../utils/cn'
import { PickupSchedule, toPickupIso, SLOT_HOURS } from './PickupSchedule'

export const CANCEL_REASONS = [
  { value: 'CHANGE_OF_PLANS', label: 'My plans changed' },
  { value: 'NOT_AVAILABLE_AT_PICKUP', label: "I won't be home at that time" },
  { value: 'BOOKED_BY_MISTAKE', label: 'I booked by mistake' },
  { value: 'WANT_DIFFERENT_SERVICE', label: 'I want a different service' },
  { value: 'OTHER', label: 'Something else' },
]
const reasonLabel = (value) => CANCEL_REASONS.find((r) => r.value === value)?.label ?? 'Not given'
const RESCHEDULE_MAX_DAYS = 7

/**
 * "Change this pickup" card on the order page: shows the deadline and the
 * Reschedule / Cancel buttons. The server enforces the same rules again.
 */
export function OrderChanges({ order, onChanged }) {
  const [dialog, setDialog] = useState(null) // 'reschedule' | 'cancel' | null
  const rules = order.changeRules

  if (order.currentStatus === 'CANCELLED') {
    if (!order.cancellation) return null
    return (
      <Card>
        <CardHeader icon={Ban} title="Cancelled" />
        <CardBody className="pt-3 text-sm">
          <p className="text-navy-700">Cancelled on {formatDateTime(order.cancellation.cancelledAt)}</p>
          <p className="mt-1 text-navy-500">Reason: {reasonLabel(order.cancellation.reason)}</p>
        </CardBody>
      </Card>
    )
  }

  // Only a booked (not yet picked up) order can be changed.
  if (!rules || order.currentStatus !== 'BOOKED') return null

  const done = (updated, message, tone) => {
    setDialog(null)
    onChanged(updated, message, tone)
  }

  return (
    <Card>
      <CardHeader icon={CalendarClock} title="Change this pickup" />
      <CardBody className="space-y-3 pt-3">
        {rules.canCancel ? (
          <>
            <p className="flex items-start gap-2 text-sm text-navy-700">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
              <span>You can reschedule or cancel until <strong>{formatDateTime(rules.changeDeadline)}</strong>.</span>
            </p>
            <div className="grid gap-2 min-[360px]:grid-cols-2">
              <Button variant="secondary" size="sm" onClick={() => setDialog('reschedule')} disabled={!rules.canReschedule}>
                <CalendarClock className="size-4" aria-hidden /> Reschedule
              </Button>
              <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => setDialog('cancel')}>
                <XCircle className="size-4" aria-hidden /> Cancel pickup
              </Button>
            </div>
            <p className="text-xs text-navy-500">
              {rules.canReschedule
                ? `${rules.reschedulesLeft} reschedule${rules.reschedulesLeft === 1 ? '' : 's'} left for this order.`
                : "You've used all reschedules for this order. You can still cancel and book again."}
            </p>
          </>
        ) : (
          <p className="text-sm text-navy-700">
            Changes closed at <strong>{formatDateTime(rules.changeDeadline)}</strong>, {rules.cutoffMinutes / 60} hours before pickup.
            {' '}Our rider may already be on the way. Please contact support if you need to change something.
          </p>
        )}
      </CardBody>

      <RescheduleDialog open={dialog === 'reschedule'} order={order} onClose={() => setDialog(null)} onDone={done} />
      <CancelDialog open={dialog === 'cancel'} order={order} onClose={() => setDialog(null)} onDone={done} />
    </Card>
  )
}

function RescheduleDialog({ open, order, onClose, onDone }) {
  const [pick, setPick] = useState({ date: null, slotHour: null })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const rules = order.changeRules

  const close = () => {
    setPick({ date: null, slotHour: null })
    setError(null)
    onClose()
  }

  async function save() {
    const iso = toPickupIso(pick.date, pick.slotHour)
    if (!iso) return setError('Pick a date and a time window.')
    setSaving(true)
    setError(null)
    try {
      const res = await api.rescheduleOrder(order.id, { pickupScheduledAt: iso, pickupSlotHours: SLOT_HOURS })
      setPick({ date: null, slotHour: null })
      onDone(res.data, `Pickup moved to ${formatSlot(res.data.pickupScheduledAt, res.data.pickupSlotHours)}`)
    } catch (err) {
      // 409: the order can no longer be changed (deadline passed, picked up...). Close, tell them, refresh.
      if (err.status === 409) onDone(null, err.message, 'error')
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Reschedule pickup"
      description={`Now: ${formatSlot(order.pickupScheduledAt, order.pickupSlotHours)}`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Keep current time</Button>
          <Button onClick={save} loading={saving} disabled={!pick.date || pick.slotHour == null}>Move pickup</Button>
        </>
      }
    >
      <PickupSchedule
        date={pick.date}
        slotHour={pick.slotHour}
        onChange={(next) => setPick((p) => ({ ...p, ...next }))}
        minLeadMinutes={rules.cutoffMinutes}
        excludeIso={order.pickupScheduledAt}
        maxAheadDays={RESCHEDULE_MAX_DAYS}
        error={error}
        hint={`Slots at least ${rules.cutoffMinutes / 60} hours away, up to ${RESCHEDULE_MAX_DAYS} days ahead. ${rules.reschedulesLeft - 1} reschedule${rules.reschedulesLeft - 1 === 1 ? '' : 's'} left after this.`}
      />
    </Modal>
  )
}

function CancelDialog({ open, order, onClose, onDone }) {
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const close = () => {
    setReason(null)
    setNote('')
    setError(null)
    onClose()
  }

  async function confirm() {
    if (!reason) return setError('Choose a reason.')
    setSaving(true)
    setError(null)
    try {
      const res = await api.cancelOrder(order.id, { reason, note })
      setReason(null)
      setNote('')
      onDone(res.data, 'Pickup cancelled')
    } catch (err) {
      if (err.status === 409) onDone(null, err.message, 'error')
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Cancel this pickup?"
      description={`${order.reference} · ${formatSlot(order.pickupScheduledAt, order.pickupSlotHours)}`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Keep order</Button>
          <Button variant="danger" onClick={confirm} loading={saving} disabled={!reason}>Cancel pickup</Button>
        </>
      }
    >
      <fieldset className="min-w-0">
        <legend className="mb-2.5 text-sm font-medium text-navy-700">Why are you cancelling?</legend>
        <div className="space-y-2">
          {CANCEL_REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition',
                reason === r.value ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-line hover:border-navy-400/50',
              )}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => { setReason(r.value); setError(null) }}
                className="size-4 accent-brand-700"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea
        className="mt-4"
        label="Anything else? (optional)"
        rows={2}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-navy-500">This can't be undone. You can book a new pickup any time.</p>
    </Modal>
  )
}
