import { api, useApi } from '../../../services/api-client'
import { Shirt } from 'lucide-react'
import { ServiceCard } from './ServiceCard'
import { Skeleton } from '../../../components/ui/Spinner'
import { EmptyState } from '../../../components/feedback/EmptyState'
import { ErrorMessage } from '../../../components/feedback/ErrorMessage'

export function useServices() {
  return useApi(() => api.listServices(), [])
}

export function ServiceList() {
  const { data, loading, error, reload } = useServices()

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    )
  }
  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (!data?.length) return <EmptyState icon={Shirt} title="No services available right now" description="Please check back soon." />

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((s, i) => (
        <div key={s.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <ServiceCard service={s} />
        </div>
      ))}
    </div>
  )
}
