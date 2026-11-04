import { api, useApi } from '../../../services/api-client'
import { Home, Briefcase, MapPin, Pencil, Trash2, Star } from 'lucide-react'
import { cn } from '../../../utils/cn'

export function useAddresses() {
  return useApi(() => api.listAddresses(), [])
}

export const ADDRESS_LABELS = { HOME: 'Home', WORK: 'Work', OTHER: 'Other' }

export function formatAddress(a) {
  if (!a) return ''
  return [a.addressLine1, a.addressLine2, a.city && `${a.city} ${a.postalCode}`].filter(Boolean).join(', ')
}

const icon = { HOME: Home, WORK: Briefcase, OTHER: MapPin }

export function AddressCard({ address, onEdit, onDelete, onMakeDefault }) {
  const Icon = icon[address.label] ?? MapPin
  return (
    <article className={cn('rounded-xl border p-4 transition', address.isDefault ? 'border-brand-200 bg-brand-50/30' : 'border-line')}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-line">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{ADDRESS_LABELS[address.label]}</span>
            {address.isDefault && <span className="rounded-md bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">Default</span>}
          </p>
          <p className="mt-1 text-sm text-navy-700">{formatAddress(address)}</p>
          <p className="mt-1 text-xs text-navy-500">
            {address.recipientName} · {address.phone}
            {address.landmark && <> · Landmark: {address.landmark}</>}
          </p>
          {address.instructions && <p className="mt-2 rounded-lg bg-canvas px-2.5 py-1.5 text-xs text-navy-700">“{address.instructions}”</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-line/70 pt-3">
        {!address.isDefault && (
          <button onClick={onMakeDefault} className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy-500 hover:bg-canvas hover:text-brand-700">
            <Star className="size-3.5" /> Set default
          </button>
        )}
        <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-canvas" aria-label={`Edit ${ADDRESS_LABELS[address.label]} address`}>
          <Pencil className="size-3.5" /> Edit
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50" aria-label={`Delete ${ADDRESS_LABELS[address.label]} address`}>
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>
    </article>
  )
}
