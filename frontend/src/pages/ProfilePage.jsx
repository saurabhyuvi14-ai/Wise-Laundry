import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, RotateCcw } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth'
import { ProfileForm } from '../features/profile/components/ProfileForm'
import { AddressManager } from '../features/addresses/components/AddressForm'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { DemoBadge } from '../components/feedback/DemoBadge'
import { api, IS_DEMO } from '../services/api-client'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { hash } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (hash === '#addresses') setTimeout(() => document.getElementById('addresses')?.scrollIntoView({ behavior: 'smooth' }), 350)
  }, [hash])

  function resetDemo() {
    api.resetDemo()
    navigate('/customer')
    window.location.reload()
  }

  return (
    <>
      <PageHeader title="Profile" description="Manage your account details and pickup addresses." badge={<DemoBadge />} />
      <div className="animate-fade-up space-y-5">
        <ProfileForm />
        <AddressManager user={user} />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {IS_DEMO ? (
            <button onClick={resetDemo} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 hover:text-navy-900">
              <RotateCcw className="size-4" /> Reset demo data
            </button>
          ) : <span />}
          <Button variant="secondary" onClick={logout} className="text-red-600">
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
      </div>
    </>
  )
}
