import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { CustomerSidebar } from '../components/navigation/CustomerSidebar'
import { MobileNav, MobileTopBar } from '../components/navigation/MobileNavigation'
import { PageSkeleton } from '../components/ui/Spinner'
import { useAuth } from '../features/auth/hooks/useAuth'

/** Shell for signed-in customers. UI guard only — the backend still enforces access. */
export function CustomerLayout() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'ready' && !user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      {user && <CustomerSidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        {user && <MobileTopBar />}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {status === 'loading' ? <PageSkeleton /> : <Outlet key={location.pathname} />}
        </main>
      </div>
      {user && <MobileNav />}
    </div>
  )
}
