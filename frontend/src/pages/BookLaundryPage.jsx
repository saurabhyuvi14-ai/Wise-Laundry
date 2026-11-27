import { useSearchParams } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { BookingForm } from '../features/orders/components/BookingForm'

export default function BookLaundryPage() {
  const [params] = useSearchParams()
  const again = params.get('again')
  return (
    <>
      <PageHeader
        back={{ to: '/customer', label: 'Back to Dashboard' }}
        title={again ? 'Book again' : 'Book a Pickup'}
        description="Choose your service and a convenient pickup time."
      />
      {again && (
        <p className="mb-5 flex animate-fade-up items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <RotateCcw className="size-4 shrink-0" aria-hidden />
          <span>Same service, speed, address and instructions as <strong>{again}</strong>. Just pick a time.</span>
        </p>
      )}
      <BookingForm />
    </>
  )
}
