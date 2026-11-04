export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h3 className="font-bold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-navy-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
