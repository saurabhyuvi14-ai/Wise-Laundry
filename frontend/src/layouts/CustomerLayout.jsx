import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { CustomerSidebar } from '../components/navigation/CustomerSidebar'
import { MobileNav, MobileTopBar } from '../components/navigation/MobileNavigation'
import { PageSkeleton } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../features/auth/hooks/useAuth'
import { LocationPromptModal } from '../features/addresses/components/LocationPromptModal'
import { AddressForm } from '../features/addresses/components/AddressForm'
import { useGeolocation } from '../features/addresses/hooks/useGeolocation'
import { useToast } from '../components/feedback/Toast'
import { api } from '../services/api-client'
import { NotificationsProvider } from '../context/NotificationsContext'

function SignupLocationSetup({ user, onDone }) {
  const toast = useToast()
  const [detectedDraft, setDetectedDraft] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState(null)
  const { detecting, error: geoError, detectLocation, cancel: cancelGeo } = useGeolocation()

  async function handleUseLocation() {
    const res = await detectLocation()
    if (res?.cancelled) return
    if (res?.ok) {
      setDetectedDraft({ ...res.data, notice: res.notice })
      setFormOpen(true)
    }
  }

  function handleClosePrompt() {
    cancelGeo()
    onDone()
  }

  async function handleSaveAddress(body) {
    setSaving(true)
    setServerErrors(null)
    try {
      await api.createAddress(body)
      toast('Pickup address saved')
      setFormOpen(false)
      onDone()
    } catch (err) {
      if (err.fields) setServerErrors(err.fields)
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <LocationPromptModal
        open={!formOpen}
        detecting={detecting}
        error={geoError}
        onUseLocation={handleUseLocation}
        onClose={handleClosePrompt}
      />

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); onDone() }}
        title="Confirm your pickup address"
        description="Review the detected details and add your flat or house number before saving."
      >
        {formOpen && (
          <AddressForm
            detectedLocation={detectedDraft}
            onSubmit={handleSaveAddress}
            onCancel={() => { setFormOpen(false); onDone() }}
            saving={saving}
            defaultName={user?.fullName}
            defaultPhone={user?.phone}
            serverErrors={serverErrors}
          />
        )}
      </Modal>
    </>
  )
}

/** Shell for signed-in customers. UI guard only — the backend still enforces access. */
export function CustomerLayout() {
  const { user, status, loggedOut, justSignedUp, dismissSignupPrompt } = useAuth()
  const location = useLocation()

  if (status === 'ready' && !user) {
    // After "Log out" go to a clean login page; otherwise remember where the customer was going.
    if (loggedOut) return <Navigate to="/login" replace />
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  const shell = (
    <div className="flex min-h-dvh bg-canvas print:bg-white">
      {user && <div className="contents print:hidden"><CustomerSidebar /></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        {user && <div className="print:hidden"><MobileTopBar /></div>}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12 print:max-w-none print:p-0">
          {status === 'loading' ? <PageSkeleton /> : <Outlet key={location.pathname} />}
        </main>
      </div>
      {user && <div className="print:hidden"><MobileNav /></div>}
      {user && justSignedUp && <SignupLocationSetup user={user} onDone={dismissSignupPrompt} />}
    </div>
  )
  return user ? <NotificationsProvider key={user.id}>{shell}</NotificationsProvider> : shell
}
