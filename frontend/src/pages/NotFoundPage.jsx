import { Shirt } from 'lucide-react'
import { Button } from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 text-center">
      <div className="animate-fade-up">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Shirt className="size-8" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-widest text-brand-700">404</p>
        <h1 className="mt-1 text-2xl font-extrabold">This page went missing in the wash</h1>
        <p className="mt-2 text-navy-500">The link may be old or mistyped.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" to="/">Home</Button>
          <Button to="/customer">Go to Dashboard</Button>
        </div>
      </div>
    </div>
  )
}
