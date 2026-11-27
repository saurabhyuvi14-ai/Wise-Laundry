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
