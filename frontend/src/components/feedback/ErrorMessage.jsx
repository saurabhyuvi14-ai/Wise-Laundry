import { CloudOff, RotateCw } from 'lucide-react'
import { Button } from '../ui/Button'

export function ErrorMessage({ error, onRetry }) {
  const notFound = error?.status === 404
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-line bg-white px-6 py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <h3 className="font-bold">{notFound ? 'Not found' : 'Something went wrong'}</h3>
      <p className="mt-1 max-w-sm text-sm text-navy-500">{error?.message ?? 'Please try again.'}</p>
      {onRetry && !notFound && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw className="size-4" /> Retry
        </Button>
      )}
      {notFound && <Button variant="secondary" size="sm" className="mt-5" to="/customer/orders">Go to My Orders</Button>}
    </div>
  )
}
