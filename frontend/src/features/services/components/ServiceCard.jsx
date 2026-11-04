import { Layers3, Shirt, WashingMachine } from 'lucide-react'
import { formatCurrency, UNIT_LABEL } from '../../../utils/formatCurrency'
import { IS_DEMO } from '../../../services/api-client'

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' }

function IronIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 18h17.5a1 1 0 0 0 1-1v-1.5A6.5 6.5 0 0 0 14.5 9H8.6a2 2 0 0 0-1.8 1.1L2.5 18z" />
      <path d="M8.5 9V6.5h8.2a2.3 2.3 0 0 1 2.3 2.3v1.4" />
      <path d="M8 14.5h.01M11 14.5h.01M14 14.5h.01" />
    </svg>
  )
}

function HangerIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 5.5a2 2 0 1 1 2 2v1.6" />
      <path d="M12 9.1 3.3 15.4A1.4 1.4 0 0 0 4.1 18h15.8a1.4 1.4 0 0 0 .8-2.6L12 9.1z" />
    </svg>
  )
}

const icons = { WASH_FOLD: Layers3, WASH_IRON: Shirt, IRON_ONLY: IronIcon, DRY_CLEAN: HangerIcon }

// Lets order snapshots (which only carry serviceName) still get the right icon.
const byName = { 'wash & fold': 'WASH_FOLD', 'wash and fold': 'WASH_FOLD', 'wash & iron': 'WASH_IRON', 'wash and iron': 'WASH_IRON', 'iron only': 'IRON_ONLY', 'dry cleaning': 'DRY_CLEAN' }

export function ServiceIcon({ code, name, className = 'size-5' }) {
  const Icon = icons[code ?? byName[name?.toLowerCase()]] ?? WashingMachine
  return <Icon className={className} aria-hidden />
}

export function ServiceCard({ service }) {
  return (
    <article className="group rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
        <ServiceIcon code={service.code} className="size-6" />
      </span>
      <h3 className="mt-5 text-lg font-bold">{service.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{service.description}</p>
      <p className="mt-5 flex items-baseline gap-1.5 border-t border-line pt-4">
        <span className="text-xl font-extrabold">{formatCurrency(service.unitPricePaise)}</span>
        <span className="text-sm text-navy-500">{UNIT_LABEL[service.pricingUnit]}</span>
        {IS_DEMO && <span className="ml-auto text-xs text-navy-400">demo price</span>}
      </p>
    </article>
  )
}
