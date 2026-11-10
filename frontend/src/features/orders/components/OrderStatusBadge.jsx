import { CalendarCheck, PackageCheck, Warehouse, WashingMachine, Shirt, Sparkles, Truck, CircleCheckBig, XCircle } from 'lucide-react'
import { cn } from '../../../utils/cn'

/** Agreed status sequence (guide §6). Stages that don't apply to a service are skipped. */
export const STATUS = {
  BOOKED: { label: 'Pickup scheduled', short: 'Booked', step: 'Scheduled', tiny: 'Booked', icon: CalendarCheck, message: 'Your pickup is scheduled.' },
  PICKED_UP: { label: 'Picked up', short: 'Picked up', step: 'Picked up', icon: PackageCheck, message: 'We have collected your laundry.' },
  RECEIVED: { label: 'At laundry', short: 'Received', step: 'At laundry', icon: Warehouse, message: 'Your bag reached our laundry. Items are being counted.' },
  WASHING: { label: 'Washing', short: 'Washing', step: 'Washing', icon: WashingMachine, message: 'Your clothes are being washed.' },
  IRONING: { label: 'Ironing', short: 'Ironing', icon: Shirt, message: 'Your clothes are being ironed.' },
  READY_FOR_DELIVERY: { label: 'Ready', short: 'Ready', icon: Sparkles, message: 'Your clothes are clean, packed and ready.' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', short: 'On the way', step: 'On the way', icon: Truck, message: 'Your laundry is on its way to you.' },
  DELIVERED: { label: 'Delivered', short: 'Delivered', step: 'Delivered', icon: CircleCheckBig, message: 'Delivered. Enjoy your fresh clothes!' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled', step: 'Cancelled', icon: XCircle, message: 'This order was cancelled.' },
}

export const TERMINAL = ['DELIVERED', 'CANCELLED']
export const isActive = (status) => !TERMINAL.includes(status)

/** Badge tone per status — text label always shown, colour is only a hint. */
export function statusTone(status) {
  if (status === 'DELIVERED') return 'success'
  if (status === 'CANCELLED') return 'danger'
  if (status === 'BOOKED') return 'neutral'
  if (status === 'READY_FOR_DELIVERY' || status === 'OUT_FOR_DELIVERY') return 'warning'
  return 'info'
}

/** Service-specific label override (a service can rename a stage via stageLabels). */
export function stageLabel(status, service) {
  return service?.stageLabels?.[status] ?? STATUS[status]?.label ?? status
}

/** Short name used under each step of the horizontal tracker. */
export function stepLabel(status, service) {
  return service?.stageLabels?.[status] ?? STATUS[status]?.step ?? STATUS[status]?.label ?? status
}

const tones = {
  neutral: 'bg-slate-100 text-navy-700',
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  brand: 'bg-brand-50 text-brand-700',
}

export function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status, label }) {
  const s = STATUS[status]
  return <Badge tone={statusTone(status)} icon={s?.icon}>{label ?? s?.short ?? status}</Badge>
}
