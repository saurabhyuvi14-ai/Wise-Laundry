import { useRef } from 'react'
import { Clock3, Zap } from 'lucide-react'
import { SlidingHighlight } from '../../../components/ui/SlidingHighlight'
import { cn } from '../../../utils/cn'

export const hoursText = (h) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hours`)

/** Standard vs Express choice under the service picker. Hidden when the service has no express option. */
export function DeliverySpeed({ service, express, onChange }) {
  const rowRef = useRef(null)
  if (!service?.express) return null
  const options = [
    { value: false, icon: Clock3, title: 'Standard', time: `Back in ${hoursText(service.turnaroundHours)}`, price: 'No extra charge' },
    { value: true, icon: Zap, title: 'Express', time: `Back in ${hoursText(service.express.turnaroundHours)}`, price: `+${service.express.surchargePercent}% on the washing price` },
  ]
  return (
    <fieldset className="mt-5 min-w-0 animate-fade-up">
      <legend className="mb-2.5 text-sm font-semibold text-navy-700">Delivery speed</legend>
      <div ref={rowRef} className="relative grid gap-3 min-[420px]:grid-cols-2">
        <SlidingHighlight
          containerRef={rowRef}
          activeKey={express ? 'express' : 'standard'}
          className={cn('border', express ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/25' : 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20')}
        />
        {options.map(({ value, icon: Icon, title, time, price }) => {
          const on = express === value
          return (
            <label
              key={title}
              data-option={value ? 'express' : 'standard'}
              className={cn(
                'relative z-10 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-[border-color,transform] duration-300 active:scale-[0.98]',
                on ? 'border-transparent' : 'border-line hover:border-navy-400/50',
              )}
            >
              <input type="radio" name="delivery-speed" className="sr-only" checked={on} onChange={() => onChange(value)} />
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg transition', on ? (value ? 'bg-amber-400 text-white' : 'bg-brand-700 text-white') : 'bg-canvas text-navy-500')}>
                <Icon className={cn('size-4', on && value && 'animate-pop')} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{title}</span>
                <span className="block text-sm text-navy-700">{time}</span>
                <span className="block text-xs text-navy-500">{price}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Small "Express" tag for order cards and headers. */
export function ExpressBadge({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800', className)}>
      <Zap className="size-3" aria-hidden /> Express
    </span>
  )
}
