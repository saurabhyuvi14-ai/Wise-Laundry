import { useId, useState } from 'react'
import { cn } from '../../utils/cn'
import { Eye, EyeOff } from 'lucide-react'

export const control =
  'w-full rounded-xl border bg-white px-3.5 text-sm text-navy-900 placeholder:text-navy-400 transition ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none disabled:bg-canvas disabled:text-navy-500'

/** Label + control + hint/error, with ids wired for screen readers. */
export function FieldShell({ label, hint, error, required, children, className }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-navy-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-navy-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ label, hint, error, required, className, inputClassName, ...props }) {
  return (
    <FieldShell {...{ label, hint, error, required, className }}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(control, 'h-11', invalid ? 'border-red-400' : 'border-line', inputClassName)}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function Textarea({ label, hint, error, required, className, ...props }) {
  return (
    <FieldShell {...{ label, hint, error, required, className }}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={3}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'resize-y py-3', invalid ? 'border-red-400' : 'border-line')}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} inputClassName="pr-11" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-[34px] right-2 rounded-lg p-1.5 text-navy-500 hover:bg-canvas"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
