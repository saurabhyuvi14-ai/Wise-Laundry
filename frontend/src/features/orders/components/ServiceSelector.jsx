import { useRef } from 'react'
import { ServiceIcon } from '../../services/components/ServiceCard'
import { SlidingHighlight } from '../../../components/ui/SlidingHighlight'
import { formatCurrency, UNIT_LABEL } from '../../../utils/formatCurrency'
import { Skeleton } from '../../../components/ui/Spinner'
import { cn } from '../../../utils/cn'

export function ServiceSelector({ services, loading, value, onChange, error }) {
  const gridRef = useRef(null)
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    )
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Service</legend>
      <div ref={gridRef} className="relative grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SlidingHighlight containerRef={gridRef} activeKey={value} className="border border-brand-500 bg-brand-50/60 shadow-lift ring-4 ring-brand-500/10" />
        {services.map((s) => {
          const selected = value === s.id
          return (
            <label
              key={s.id}
              data-option={s.id}
              className={cn(
                'relative z-10 flex cursor-pointer flex-col rounded-xl border p-4 transition-[border-color,background-color,transform] duration-300 active:scale-[0.98]',
                'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-100',
                // The selected look comes from the gliding box behind the card.
                selected ? 'border-transparent' : 'border-line hover:border-navy-400/50 hover:bg-canvas/60',
              )}
            >
              <input type="radio" name="service" value={s.id} checked={selected} onChange={() => onChange(s.id)} className="sr-only" />
              <span className="flex items-start justify-between">
                <span className={cn('grid size-10 place-items-center rounded-lg transition', selected ? 'bg-brand-700 text-white' : 'bg-canvas text-navy-700')}>
                  <ServiceIcon code={s.code} />
                </span>
                <span className={cn('grid size-5 place-items-center rounded-full border-2 transition', selected ? 'border-brand-700' : 'border-navy-400/50')} aria-hidden>
                  <span className={cn('size-2.5 rounded-full bg-brand-700 transition', selected ? 'scale-100' : 'scale-0')} />
                </span>
              </span>
              <span className="mt-3 text-sm font-bold">{s.name}</span>
              <span className="mt-0.5 text-xs text-navy-500">
                {formatCurrency(s.unitPricePaise)} {UNIT_LABEL[s.pricingUnit]}
              </span>
            </label>
          )
        })}
      </div>
      <p className={cn('mt-3 text-sm', error ? 'font-medium text-red-600' : 'text-navy-500')}>
        {error ?? 'Hand over your items at pickup. Final quantity and price are confirmed after collection.'}
      </p>
    </fieldset>
  )
}
