import { Check } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { ServiceSelector } from './ServiceSelector'
import { AddressSelector } from './AddressSelector'
import { PickupSchedule } from './PickupSchedule'
import { useBooking } from '../hooks/useBooking'
import { BookingSummary } from './BookingSummary'
import { Textarea } from '../../../components/ui/Input'

/** Numbered section of the booking flow; turns teal with a tick when complete. */
export function BookingStep({ number, title, optional, done, children, action }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6" aria-labelledby={`step-${number}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={`step-${number}`} className="flex items-center gap-3 text-base font-bold">
          <span
            className={cn(
              'grid size-7 place-items-center rounded-full text-xs font-bold transition-all',
              done ? 'bg-brand-700 text-white' : 'bg-canvas text-navy-500 ring-1 ring-line',
            )}
          >
            {done ? <Check className="size-4 animate-pop" strokeWidth={3} /> : number}
          </span>
          {title}
          {optional && <span className="text-sm font-normal text-navy-400">(optional)</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function BookingForm() {
  const { draft, update, services, addresses, service, address, scheduled, stepsDone, submitting, errors, submit } = useBooking()

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <BookingStep number={1} title="Select a service" done={Boolean(service)}>
          <ServiceSelector
            services={services.data ?? []}
            loading={services.loading}
            value={draft.serviceId}
            onChange={(serviceId) => update({ serviceId })}
            error={errors['items.0.serviceId']}
          />
        </BookingStep>

        <BookingStep number={2} title="Pickup address" done={Boolean(address)}>
          <AddressSelector
            addresses={addresses.data}
            loading={addresses.loading}
            value={draft.addressId}
            onChange={(addressId) => update({ addressId })}
            error={errors.addressId}
          />
        </BookingStep>

        <BookingStep number={3} title="Schedule pickup" done={scheduled}>
          <PickupSchedule date={draft.date} slotHour={draft.slotHour} onChange={update} error={errors.pickupScheduledAt} />
        </BookingStep>

        <BookingStep number={4} title="Pickup instructions" optional done={Boolean(draft.instructions.trim())}>
          <Textarea
            aria-label="Pickup instructions"
            placeholder="Gate number, landmark or instructions for our team"
            maxLength={240}
            value={draft.instructions}
            onChange={(e) => update({ instructions: e.target.value })}
            hint={`${draft.instructions.length}/240`}
          />
        </BookingStep>
      </div>

      <BookingSummary
        service={service}
        address={address}
        date={draft.date}
        slotHour={draft.slotHour}
        stepsDone={stepsDone}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  )
}
