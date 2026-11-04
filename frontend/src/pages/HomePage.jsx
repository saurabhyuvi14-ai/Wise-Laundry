import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, PackageCheck, WashingMachine, Truck, Check } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ServiceList } from '../features/services/components/ServiceList'

const steps = [
  { icon: CalendarCheck, title: 'Book', text: 'Pick a service and a pickup window in under a minute.' },
  { icon: PackageCheck, title: 'Hand over', text: 'We collect your bag, then weigh or count it.' },
  { icon: WashingMachine, title: 'We clean', text: 'Washed, ironed or dry cleaned — as you chose.' },
  { icon: Truck, title: 'Delivered', text: 'Fresh clothes back at your door. Track every stage.' },
]

/** Illustrative UI preview built from real components' styles — not a screenshot of fake data. */
function HeroPreview() {
  const rows = [
    ['Pickup scheduled', true],
    ['Picked up', true],
    ['Washing', 'current'],
    ['Ready', false],
    ['Delivered', false],
  ]
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-100 via-brand-50 to-transparent blur-2xl" aria-hidden />
      <div className="animate-fade-up rounded-2xl border border-line bg-white p-5 shadow-lift" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-navy-500">Example order</p>
            <p className="font-extrabold">WL-0001 · Wash & Iron</p>
          </div>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Washing</span>
        </div>
        <ol className="mt-5 space-y-3">
          {rows.map(([label, state], i) => (
            <li key={label} className="flex animate-fade-up items-center gap-3 text-sm" style={{ animationDelay: `${300 + i * 90}ms` }}>
              <span className={
                state === true ? 'grid size-6 place-items-center rounded-full bg-brand-500 text-white'
                  : state === 'current' ? 'grid size-6 animate-pulse-ring place-items-center rounded-full bg-brand-700 text-white'
                    : 'size-6 rounded-full border border-line bg-canvas'
              }>
                {state === true && <Check className="size-3.5" strokeWidth={3} />}
                {state === 'current' && <span className="size-2 rounded-full bg-white" />}
              </span>
              <span className={state ? 'font-semibold' : 'text-navy-400'}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--color-brand-50),transparent)]" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
              <span className="size-1.5 rounded-full bg-brand-500" /> Laundry pickup in Bengaluru
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
              Laundry, picked up.<br />
              <span className="text-brand-700">Tracked till it's back.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-navy-500">
              Book a pickup, hand over your bag, and watch every stage — washing, ironing, delivery — from your phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/customer/book" size="lg">Book a Pickup <ArrowRight className="size-4" /></Button>
              <Button to="/services" size="lg" variant="secondary">Explore Services</Button>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
                  <span className="text-3xl font-extrabold text-navy-900/10">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-navy-500">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight">Services</h2>
          <Link to="/services" className="text-sm font-semibold text-brand-700 hover:underline">All details</Link>
        </div>
        <ServiceList />
      </section>
    </>
  )
}
