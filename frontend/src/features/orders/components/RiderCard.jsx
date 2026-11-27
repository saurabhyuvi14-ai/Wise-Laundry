import { Phone, Bike } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'

/** "Ravi is on the way" with a call button. The server only sends a rider while they're coming to you. */
export function RiderCard({ rider, status }) {
  if (!rider || !['BOOKED', 'OUT_FOR_DELIVERY'].includes(status)) return null
  const delivering = status === 'OUT_FOR_DELIVERY'
  return (
    <Card className="flex animate-fade-up flex-wrap items-center gap-4 border-brand-200 p-5">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-brand-700 text-lg font-bold text-white">
        {rider.fullName[0]}
        {delivering && <span className="absolute -right-0.5 -bottom-0.5 size-3.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm text-navy-500">
          <Bike className="size-4" aria-hidden /> {delivering ? 'On the way with your clothes' : 'Your pickup rider'}
        </p>
        <p className="text-lg font-bold">{rider.fullName}</p>
      </div>
      {rider.phone && (
        <Button href={`tel:${rider.phone}`} variant="secondary" size="sm">
          <Phone className="size-4" aria-hidden /> Call {rider.fullName.split(' ')[0]}
        </Button>
      )}
    </Card>
  )
}

/** The 4-digit code the customer reads out to the rider at delivery. */
export function DeliveryCode({ code }) {
  if (!code) return null
  return (
    <Card className="animate-fade-up border-amber-200 bg-amber-50/60 p-5 text-center">
      <p className="text-sm font-semibold text-amber-900">Delivery code</p>
      <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.35em] text-navy-900" aria-label={`Delivery code ${code.split('').join(' ')}`}>{code}</p>
      <p className="mt-2 text-sm text-navy-700">Tell this to the rider when they hand over your clothes. Don't share it before.</p>
    </Card>
  )
}
