import { cn } from '../../utils/cn'

export function Card({ as: Tag = 'section', className, children, ...props }) {
  return (
    <Tag className={cn('rounded-2xl border border-line bg-white shadow-soft', className)} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
        <div>
          <h2 className="text-base font-bold text-navy-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-navy-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>
}
