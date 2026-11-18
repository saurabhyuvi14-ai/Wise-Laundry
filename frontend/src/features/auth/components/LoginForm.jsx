import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Input, PasswordInput } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { IS_DEMO } from '../../../services/api-client'
import { demoUser } from '../../../demo/user'
import { validate, required, isEmail, safeRedirect } from '../../../utils/bookingValidation'
// OTP login is switched off until the backend has the OTP endpoints. To turn it on, remove the
// comments marked "OTP" in this file.
// OTP: import { OtpLoginForm } from './OtpLoginForm'

const schema = {
  email: [[required, 'Enter your email.'], [isEmail, 'Enter a valid email address.']],
  password: [[required, 'Enter your password.']],
}

/** Email + password login. */
export function EmailLoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  const set = (f) => (e) => setValues((v) => ({ ...v, [f]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const body = values
    const found = validate(body, schema)
    setErrors(found)
    if (Object.keys(found).length) return
    setPending(true)
    setFormError('')
    try {
      await login(body)
      navigate(safeRedirect(params.get('redirect')), { replace: true })
    } catch (err) {
      setFormError(err.message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{formError}</p>}
      <Input label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" />
      <PasswordInput label="Password" autoComplete="current-password" value={values.password} onChange={set('password')} error={errors.password} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Log in</Button>
    </form>
  )
}

/** Login screen: email and password. (Mobile number + OTP is built but switched off for now.) */
export function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // OTP: const [mode, setMode] = useState('phone') // phone | email
  const [demoPending, setDemoPending] = useState(false)

  async function demoLogin() {
    // Demo login always opens the Dashboard (the app's home), whatever page was open before.
    setParams({}, { replace: true })
    setDemoPending(true)
    try {
      await login({ email: demoUser.email, password: 'demo' })
      navigate('/customer', { replace: true })
    } catch {
      setDemoPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <EmailLoginForm />

      {/* OTP: replace <EmailLoginForm /> above with this block.
      {mode === 'phone' ? <OtpLoginForm /> : <EmailLoginForm />}
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'phone' ? 'email' : 'phone'))}
        className="w-full text-center text-sm font-semibold text-brand-700 hover:underline"
      >
        {mode === 'phone' ? 'Use email instead' : 'Use mobile number instead'}
      </button>
      */}

      {IS_DEMO && (
        <button
          type="button"
          onClick={demoLogin}
          disabled={demoPending}
          className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50/60 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
        >
          Continue with demo account
        </button>
      )}

      <p className="text-center text-sm text-navy-500">
        New to Wise Laundry? <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect'))}` : ''}`} className="font-semibold text-brand-700 hover:underline">Create an account</Link>
      </p>
    </div>
  )
}
