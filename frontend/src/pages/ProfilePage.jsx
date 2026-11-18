import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth'
import { ProfileForm } from '../features/profile/components/ProfileForm'
import { AddressManager } from '../features/addresses/components/AddressForm'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash === '#addresses') setTimeout(() => document.getElementById('addresses')?.scrollIntoView({ behavior: 'smooth' }), 350)
  }, [hash])

  return (
    <>
      <PageHeader title="Profile" description="Manage your account details and pickup addresses." />
      <div className="animate-fade-up space-y-5">
        <ProfileForm />
        <AddressManager user={user} />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span />
          <Button variant="secondary" onClick={logout} className="text-red-600">
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
      </div>
    </>
  )
}
