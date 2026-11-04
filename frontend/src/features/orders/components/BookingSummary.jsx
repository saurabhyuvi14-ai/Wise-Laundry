import { Info, ArrowRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { ADDRESS_LABELS } from '../../addresses/components/AddressCard'
import { formatCurrency, UNIT_LABEL } from '../../../utils/formatCurrency'
import { formatShortDate } from '../../../utils/formatDate'
import { slotLabel } from './PickupSchedule'

function Row({ label, value, muted }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 text-sm last:border-0">
      <dt className="text-navy-500">{label}</dt>
      <dd className={muted ? 'text-right text-navy-400' : 'text-right font-semibold'}>{value}</dd>
    </div>
  )
}

export function BookingSummary({ service, address, date, slotHour, stepsDone, submitting, onSubmit }) {
  const ready = stepsDone === 3
  return (
    <aside className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6 lg:sticky lg:top-6">
      <h2 className="text-lg font-bold">Booking summary</h2>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${(stepsDone / 3) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-navy-500">{stepsDone} of 3 required steps done</p>

      <dl className="mt-3">
        <Row label="Service" value={service?.name ?? 'Not selected'} muted={!service} />
        <Row label="Rate" value={service ? `${formatCurrency(service.unitPricePaise)} ${UNIT_LABEL[service.pricingUnit]}` : '—'} muted={!service} />
        <Row label="Quantity" value="Confirmed at pickup" />
        <Row label="Address" value={address ? ADDRESS_LABELS[address.label] : 'Not selected'} muted={!address} />
        <Row
          label="Pickup"
          value={date && slotHour != null ? `${formatShortDate(date)}, ${slotLabel(slotHour)}` : 'Not scheduled'}
          muted={!(date && slotHour != null)}
        />
      </dl>

      <p className="mt-4 flex gap-2.5 rounded-xl bg-brand-50 p-3.5 text-sm text-brand-800">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Final price confirmed after collection.
      </p>

      <Button size="lg" className="mt-5 w-full" disabled={!ready} loading={submitting} onClick={onSubmit}>
        {submitting ? 'Booking…' : 'Confirm Pickup'}
        {!submitting && <ArrowRight className="size-4" />}
      </Button>
      <p className="mt-3 text-center text-xs text-navy-500">
        {ready ? 'Review your details before confirming.' : 'Complete the steps to confirm.'}
      </p>
    </aside>
  )
}
