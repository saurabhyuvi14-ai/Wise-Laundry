import { ServiceList } from '../features/services/components/ServiceList'
import { Button } from '../components/ui/Button'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { IS_DEMO } from '../services/api-client'

export default function ServicesPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Services</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Pick what your clothes need</h1>
          <p className="mt-3 text-navy-500">Prices are per kg or per item. We weigh or count at pickup, so you only pay for what you hand over.</p>
          <div className="mt-3"><DemoBadge /></div>
        </div>
        <Button to="/customer/book" size="lg">Book a Pickup</Button>
      </div>
      <ServiceList />
      {IS_DEMO && <p className="mt-6 text-xs text-navy-400">Demo prices. Live rates load from the server.</p>}
    </section>
  )
}
