import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({ title, description, back, action, badge }) {
  return (
    <header className="mb-6 animate-fade-up sm:mb-8">
      {back && (
        <Link to={back.to} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-brand-700">
          <ArrowLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 text-navy-500">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
