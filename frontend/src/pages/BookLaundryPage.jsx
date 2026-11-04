import { PageHeader } from '../components/ui/PageHeader'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { BookingForm } from '../features/orders/components/BookingForm'

export default function BookLaundryPage() {
  return (
    <>
      <PageHeader
        back={{ to: '/customer', label: 'Back to Dashboard' }}
        title="Book a Pickup"
        description="Choose your service and a convenient pickup time."
        badge={<DemoBadge />}
      />
      <BookingForm />
    </>
  )
}
