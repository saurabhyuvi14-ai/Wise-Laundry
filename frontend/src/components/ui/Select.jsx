import { FieldShell, control } from './Input'
import { cn } from '../../utils/cn'

export function Select({ label, hint, error, required, className, children, ...props }) {
  return (
    <FieldShell {...{ label, hint, error, required, className }}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[right_0.9rem_center] bg-no-repeat pr-10', invalid ? 'border-red-400' : 'border-line')}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
