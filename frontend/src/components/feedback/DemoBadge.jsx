import { FlaskConical } from 'lucide-react'
import { IS_DEMO } from '../../services/api-client'

/** Guide §4: demo data must always be labelled. */
export function DemoBadge({ className = '' }) {
  if (!IS_DEMO) return null
  return (
    <span title="Demo data — nothing is saved to a server yet" className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ${className}`}>
      <FlaskConical className="size-3" aria-hidden /> Demo data
    </span>
  )
}
