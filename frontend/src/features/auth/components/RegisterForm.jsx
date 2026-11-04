import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Input, PasswordInput } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { validate, required, isEmail, isPhone, safeRedirect } from '../../../utils/bookingValidation'

const schema = {
  fullName: [[required, 'Enter your full name.']],
  email: [[required, 'Enter your email.'], [isEmail, 'Enter a valid email address.']],
  phone: [[required, 'Enter your mobile number.'], [isPhone, 'Enter a valid 10-digit mobile number.']],
  password: [[required, 'Create a password.'], [(v) => v.length >= 8, 'Use at least 8 characters.']],
  confirmPassword: [[(v, all) => v === all.password, 'Passwords do not match.']],
}

export function RegisterForm() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  const set = (f) => (e) => setValues((v) => ({ ...v, [f]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const found = validate(values, schema)
    setErrors(found)
    if (Object.keys(found).length) return
    setPending(true)
    setFormError('')
    try {
      // confirmPassword is checked here only and never sent.
      const { confirmPassword: _c, ...body } = values
      await register({ ...body, phone: body.phone.replace(/\D/g, '').slice(-10) })
      navigate(safeRedirect(params.get('redirect')), { replace: true })
    } catch (err) {
      setErrors(err.fields ?? {})
      setFormError(err.message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{formError}</p>}
      <Input label="Full name" autoComplete="name" value={values.fullName} onChange={set('fullName')} error={errors.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <Input label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel" value={values.phone} onChange={set('phone')} error={errors.phone} />
      </div>
      <PasswordInput label="Password" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} hint="At least 8 characters." />
      <PasswordInput label="Confirm password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Create account</Button>
      <p className="text-center text-sm text-navy-500">
        Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
      </p>
    </form>
  )
}
