import { useEffect, useState } from 'react'
import { Bell, BellRing, BellOff } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/feedback/Toast'
import { pushSupported, pushState, enablePush, disablePush } from '../push'

/** Opt-in card to turn on phone/desktop notifications even when the site is closed. */
export function PushToggle() {
  const toast = useToast()
  const [state, setState] = useState('loading') // loading | unsupported | blocked | on | off
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!pushSupported()) { setState('unsupported'); return }
    pushState().then(setState)
  }, [])

  if (state === 'loading' || state === 'unsupported') return null

  async function enable() {
    setBusy(true)
    try {
      await enablePush()
      setState('on')
      toast("Notifications on — we'll ping you at each step.")
    } catch (err) {
      toast(err.message, 'error')
      setState(await pushState())
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      await disablePush()
      setState('off')
      toast('Notifications turned off on this device.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'on') {
    return (
      <Card className="mb-5 flex items-center gap-3 border-emerald-200 bg-emerald-50/50 p-4">
        <BellRing className="size-5 shrink-0 text-emerald-600" aria-hidden />
        <p className="min-w-0 flex-1 text-sm font-medium text-emerald-900">Notifications are on for this device.</p>
        <Button variant="ghost" size="sm" loading={busy} onClick={disable}>Turn off</Button>
      </Card>
    )
  }

  if (state === 'blocked') {
    return (
      <Card className="mb-5 flex items-center gap-3 p-4">
        <BellOff className="size-5 shrink-0 text-navy-500" aria-hidden />
        <p className="text-sm text-navy-700">Notifications are blocked. Turn them on for this site in your browser settings.</p>
      </Card>
    )
  }

  return (
    <Card className="mb-5 flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50/40 p-4">
      <Bell className="size-5 shrink-0 text-brand-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Get alerts even when the app is closed</p>
        <p className="text-sm text-navy-500">We'll let you know when your clothes are picked up, washed and on the way.</p>
      </div>
      <Button size="sm" loading={busy} onClick={enable}>Turn on</Button>
    </Card>
  )
}
