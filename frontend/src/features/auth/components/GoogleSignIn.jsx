import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { FieldShell, control } from '../../../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../../../utils/cn'
import { safeRedirect } from '../../../utils/bookingValidation'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

// Google's script is loaded once and shared by every button on the page.
let scriptPromise
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google did not load')))
    script.onerror = () => {
      scriptPromise = undefined
      reject(new Error('Google did not load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

// initialize() must only run once per page, so the latest callback is kept here.
let onCredential = () => {}
let initialized = false

function GoogleButton({ text, onCredentialReceived, onUnavailable }) {
  const ref = useRef(null)

  useEffect(() => {
    let cancelled = false
    onCredential = onCredentialReceived
    loadGoogleScript()
      .then((google) => {
        if (cancelled || !ref.current) return
        if (!initialized) {
          google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response) => onCredential(response.credential),
            ux_mode: 'popup',
            context: 'signin',
            // Returning people are signed straight back in, without tapping anything.
            auto_select: true,
            // Lets the "Continue as …" card show in Safari on iPhone too.
            itp_support: true,
            cancel_on_tap_outside: false,
          })
          initialized = true
          // Show the "Continue as …" card on its own, once per page load.
          google.accounts.id.prompt()
        }
        google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, ref.current.offsetWidth)),
        })
      })
      .catch(() => !cancelled && onUnavailable())
    return () => { cancelled = true }
  }, [text, onCredentialReceived, onUnavailable])

  return <div ref={ref} className="flex min-h-11 w-full justify-center" />
}

/**
 * "Continue with Google" above the email form.
 * A new person is asked for their mobile number once (the backend needs one for every customer).
 * Hidden when VITE_GOOGLE_CLIENT_ID is not set or Google's script can't load.
 */
export function GoogleSignIn({ mode = 'signin', header, children }) {
  const { googleSignIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [available, setAvailable] = useState(Boolean(CLIENT_ID))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [newPerson, setNewPerson] = useState(null) // { credential, profile }
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const done = () => navigate(safeRedirect(params.get('redirect')), { replace: true })

  // Stable references so the Google button isn't redrawn on every keystroke.
  const handlers = useRef({})
  handlers.current.credential = async (credential) => {
    setPending(true)
    setError('')
    try {
      const res = await googleSignIn(credential)
      if (res.needsPhone) {
        setNewPerson({ credential, profile: res.profile })
        setPending(false)
      } else {
        done()
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.')
      setPending(false)
    }
  }
  const [onCredentialReceived] = useState(() => (credential) => handlers.current.credential(credential))
  const [onUnavailable] = useState(() => () => setAvailable(false))

  async function savePhone(e) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setPhoneError('Enter a valid 10-digit mobile number.')
      return
    }
    setPending(true)
    setPhoneError('')
    try {
      await googleSignIn(newPerson.credential, digits)
      done()
    } catch (err) {
      // The Google proof expires after about an hour; start again if it has.
      if (err.status === 401) {
        setNewPerson(null)
        setError('That took too long. Please continue with Google again.')
      } else {
        setPhoneError(err.fields?.phone || err.message)
      }
      setPending(false)
    }
  }

  if (newPerson) {
    return (
      <form onSubmit={savePhone} noValidate className="space-y-4">
        <button
          type="button"
          onClick={() => { setNewPerson(null); setPhone(''); setPhoneError('') }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>
        <div>
          <h2 className="text-lg font-bold">One last step</h2>
          <p className="mt-1 text-sm text-navy-500">Add your mobile number so our rider can reach you at pickup.</p>
          <p className="mt-3 rounded-xl bg-canvas px-3.5 py-2.5 text-sm">
            <span className="block font-semibold text-navy-900">{newPerson.profile.fullName}</span>
            <span className="block truncate text-navy-500" title={newPerson.profile.email}>{newPerson.profile.email}</span>
          </p>
        </div>
        <FieldShell label="Mobile number" error={phoneError}>
          {({ id, describedBy, invalid }) => (
            <div className={cn('flex h-11 items-center overflow-hidden rounded-xl border bg-white transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100', invalid ? 'border-red-400' : 'border-line')}>
              <span className="border-r border-line px-3 text-sm font-semibold text-navy-700">+91</span>
              <input
                id={id}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(control, 'h-full rounded-none border-0 focus:ring-0')}
              />
            </div>
          )}
        </FieldShell>
        <Button type="submit" size="lg" className="w-full" loading={pending}>Create account</Button>
      </form>
    )
  }

  return (
    <>
      {header}
      <div className="space-y-4">
        {available && (
          <>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
            <div className={cn('transition', pending && 'pointer-events-none opacity-50')} aria-busy={pending || undefined}>
              <GoogleButton
                text={mode === 'signup' ? 'signup_with' : 'continue_with'}
                onCredentialReceived={onCredentialReceived}
                onUnavailable={onUnavailable}
              />
            </div>
            <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-navy-400 uppercase" aria-hidden>
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        {children}
      </div>
    </>
  )
}
