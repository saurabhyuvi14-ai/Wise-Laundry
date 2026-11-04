import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '../../../utils/cn'

/** The one entry point to booking — a small, eye-catching pill on the Dashboard. */
export function BookPickupButton({ className }) {
  return (
    <Link
      to="/customer/book"
      className={cn(
        'group relative inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-full pr-5 pl-1.5 text-sm font-bold text-white',
        'bg-gradient-to-r from-brand-700 to-brand-500 shadow-lift transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgb(15_118_110/0.55)] active:translate-y-0',
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-90">
        <Plus className="size-4" strokeWidth={3} aria-hidden />
      </span>
      Select & Book a Pickup
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </Link>
  )
}
