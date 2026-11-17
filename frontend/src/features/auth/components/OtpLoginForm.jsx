import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Input, FieldShell, control } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { IS_DEMO } from '../../../services/api-client'
import { DEMO_OTP } from '../../../demo/demo-api'
import { cn } from '../../../utils/cn'
import { isPhone, safeRedirect } from '../../../utils/bookingValidation'

const CODE_LENGTH = 6
const digitsOnly = (v) => v.replace(/\D/g, '')

/** Six single-digit boxes. Typing moves forward, Backspace moves back, pasting fills them all. */
export function OtpInput({ value, onChange, onComplete, error, disabled }) {
  const refs = useRef([])
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '')

  // Focus the first box on open, and again after a wrong code clears the boxes.
  useEffect(() => {
    if (!disabled && !value) refs.current[0]?.focus()
  }, [disabled, value])

  function update(next) {
    const code = next.slice(0, CODE_LENGTH)
    onChange(code)
    if (code.length === CODE_LENGTH) onComplete?.(code)
  }

  function handleChange(i, raw) {
    const typed = digitsOnly(raw)
    if (!typed) return
    // A paste or SMS autofill can drop several digits into one box.
    const next = (value.slice(0, i) + typed).slice(0, CODE_LENGTH)
    update(next)
    refs.current[Math.min(next.length, CODE_LENGTH - 1)]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const cut = digits[i] ? i : Math.max(i - 1, 0)
      onChange(value.slice(0, cut))
      refs.current[cut]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  return (
    <FieldShell label="6-digit code" error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="flex justify-between gap-1.5 min-[360px]:gap-2" role="group" aria-labelledby={id}>
          {digits.map((d, i) => (
            <input
              key={i}
              id={i === 0 ? id : undefined}
              ref={(el) => { refs.current[i] = el }}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              onPaste={(e) => {
                e.preventDefault()
                const pasted = digitsOnly(e.clipboardData.getData('text'))
                if (pasted) {
                  update(pasted)
                  refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
                }
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={CODE_LENGTH}
              disabled={disabled}
              aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(
                control,
                'h-12 min-w-0 flex-1 px-0 text-center text-lg font-bold tabular-nums sm:h-14 sm:text-xl',
                invalid ? 'border-red-400' : 'border-line',
              )}
            />
          ))}
        </div>
      )}
    </FieldShell>
  )
}

function useCountdown(untilIso) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!untilIso) return
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [untilIso])
  return untilIso ? Math.max(0, Math.ceil((new Date(untilIso) - now) / 1000)) : 0
}

/**
 * Login with a mobile number and a one-time code.
 * Steps: phone → code → (new numbers only) name.
 */
export function OtpLoginForm() {
  const { requestOtp, verifyOtp, completeProfile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState('phone') // phone | code | name
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [resendAt, setResendAt] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const secondsLeft = useCountdown(resendAt)

  const tenDigits = digitsOnly(phone).slice(-10)
  const done = () => navigate(safeRedirect(params.get('redirect')), { replace: true })

  function fail(err) {
    // Show the message under the field it belongs to, or as a banner if it isn't about one field.
    if (err.fields?.code) setErrors({ code: err.message })
    else if (err.fields?.phone) setErrors({ phone: err.fields.phone })
    else setFormError(err.message)
    setPending(false)
  }

  async function sendCode(e) {
    e?.preventDefault()
    if (!isPhone(tenDigits) || tenDigits.length !== 10) {
      setErrors({ phone: 'Enter a valid 10-digit mobile number.' })
      return
    }
    setPending(true)
    setErrors({})
    setFormError('')
    try {
      const res = await requestOtp(tenDigits)
      setResendAt(res.data.resendAvailableAt)
      setCode('')
      setStep('code')
      setPending(false)
    } catch (err) {
      fail(err)
    }
  }

  async function checkCode(value = code) {
    if (value.length !== CODE_LENGTH) {
      setErrors({ code: 'Enter all 6 digits.' })
      return
    }
    if (pending) return
    setPending(true)
    setErrors({})
    setFormError('')
    try {
      const res = await verifyOtp(tenDigits, value)
      if (res.isNewUser) {
        setStep('name')
        setPending(false)
      } else {
        done()
      }
    } catch (err) {
      setCode('')
      fail(err)
    }
  }

  async function saveName(e) {
    e.preventDefault()
    const name = fullName.trim()
    if (name.length < 2) {
      setErrors({ fullName: 'Enter your name.' })
      return
    }
    setPending(true)
    setErrors({})
    try {
      await completeProfile({ fullName: name, phone: tenDigits })
      done()
    } catch (err) {
      fail(err)
    }
  }

  const alert = formError && (
    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{formError}</p>
  )

  if (step === 'name') {
    return (
      <form onSubmit={saveName} noValidate className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Tell us your name</h2>
          <p className="mt-1 text-sm text-navy-500">So our rider knows who to ask for at pickup.</p>
        </div>
        {alert}
        <Input label="Full name" autoComplete="name" autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} placeholder="Your name" />
        <Button type="submit" size="lg" className="w-full" loading={pending}>Continue</Button>
      </form>
    )
  }

  if (step === 'code') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); checkCode() }} noValidate className="space-y-4">
        <div>
          <button
            type="button"
            onClick={() => { setStep('phone'); setErrors({}); setFormError('') }}
            className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> Change number
          </button>
          <p className="text-sm text-navy-500">
            We sent a code to <span className="font-semibold whitespace-nowrap text-navy-900">+91 {tenDigits.slice(0, 5)} {tenDigits.slice(5)}</span>
          </p>
        </div>
        {alert}
        {IS_DEMO && (
          <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3.5 py-2.5 text-sm text-amber-800">
            Demo: no SMS is sent. Use code <span className="font-bold tracking-widest">{DEMO_OTP}</span>
          </p>
        )}
        <OtpInput value={code} onChange={setCode} onComplete={checkCode} error={errors.code} disabled={pending} />
        <Button type="submit" size="lg" className="w-full" loading={pending}>Verify and continue</Button>
        <p className="text-center text-sm text-navy-500">
          {secondsLeft > 0 ? (
            <>Resend code in <span className="font-semibold tabular-nums">0:{String(secondsLeft).padStart(2, '0')}</span></>
          ) : (
            <>Didn&apos;t get it? <button type="button" onClick={sendCode} disabled={pending} className="font-semibold text-brand-700 hover:underline disabled:opacity-50">Resend code</button></>
          )}
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} noValidate className="space-y-4">
      {alert}
      <FieldShell label="Mobile number" error={errors.phone} hint="We'll send a 6-digit code by SMS.">
        {({ id, describedBy, invalid }) => (
          <div className={cn('flex h-11 items-center overflow-hidden rounded-xl border bg-white transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100', invalid ? 'border-red-400' : 'border-line')}>
            <span className="border-r border-line px-3 text-sm font-semibold text-navy-700">+91</span>
            <input
              id={id}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              maxLength={11}
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(digitsOnly(e.target.value).slice(0, 10))}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="h-full min-w-0 flex-1 px-3 text-sm tracking-wide text-navy-900 placeholder:text-navy-400 focus:outline-none"
            />
          </div>
        )}
      </FieldShell>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Send OTP</Button>
    </form>
  )
}
