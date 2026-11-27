import { RotateCcw } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useAddresses } from '../../addresses/components/AddressCard'
import { useBookAgain } from '../hooks/useBooking'

/** Starts a new booking with the same service, address and instructions as `order`. */
export function BookAgainButton({ order, variant = 'secondary', size, className, children = 'Book again' }) {
  const addresses = useAddresses()
  const bookAgain = useBookAgain()
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={addresses.loading}
      onClick={() => bookAgain(order, addresses.data ?? [])}
    >
      <RotateCcw className="size-4" aria-hidden /> {children}
    </Button>
  )
}
