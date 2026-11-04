import { Outlet, Navigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/navigation/Navbar'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { useAuth } from '../features/auth/hooks/useAuth'
import { safeRedirect } from '../utils/bookingValidation'

export function AuthLayout() {
  const { user, status } = useAuth()
  const [params] = useSearchParams()
  if (status === 'ready' && user) return <Navigate to={safeRedirect(params.get('redirect'))} replace />

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-50 to-transparent" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <DemoBadge />
        </div>
        <div className="animate-fade-up rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
