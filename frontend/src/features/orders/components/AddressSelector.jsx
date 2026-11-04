import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Briefcase, MapPin, Plus } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Spinner'
import { ADDRESS_LABELS, formatAddress } from '../../addresses/components/AddressCard'
import { cn } from '../../../utils/cn'

const labelIcon = { HOME: Home, WORK: Briefcase, OTHER: MapPin }

function AddressSummary({ address }) {
  const Icon = labelIcon[address.label] ?? MapPin
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{ADDRESS_LABELS[address.label]}</span>
          <span className="font-bold">{address.recipientName}</span>
          <span className="text-navy-500">· {address.phone}</span>
        </p>
        <p className="mt-1 text-sm text-navy-700">{formatAddress(address)}</p>
        {address.landmark && <p className="mt-0.5 text-xs text-navy-500">Landmark: {address.landmark}</p>}
      </div>
    </div>
  )
}

export function AddressSelector({ addresses, loading, value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const selected = addresses?.find((a) => a.id === value)

  if (loading) return <Skeleton className="h-20 rounded-xl" />

  if (!addresses?.length) {
    return (
      <div className="rounded-xl border border-dashed border-line p-5 text-center">
        <p className="text-sm text-navy-500">You have no saved pickup address yet.</p>
        <Button to="/customer/profile#addresses" variant="soft" size="sm" className="mt-3">
          <Plus className="size-4" /> Add address in Profile
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className={cn('flex items-start justify-between gap-4 rounded-xl border p-4', error ? 'border-red-400' : 'border-line')}>
        {selected ? <AddressSummary address={selected} /> : <p className="text-sm text-navy-500">Choose where we should pick up.</p>}
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
          {selected ? 'Change' : 'Choose'}
        </button>
      </div>
      <p className={cn('mt-3 text-sm', error ? 'font-medium text-red-600' : 'text-navy-500')}>
        {error ?? (
          <>Manage saved addresses in <Link to="/customer/profile#addresses" className="font-medium text-brand-700 underline underline-offset-4">Profile</Link>.</>
        )}
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pickup address"
        description="Choose one of your saved addresses."
        footer={<Button variant="secondary" size="sm" to="/customer/profile#addresses"><Plus className="size-4" /> New address</Button>}
      >
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Saved addresses">
          {addresses.map((a) => (
            <button
              type="button"
              role="radio"
              aria-checked={a.id === value}
              key={a.id}
              onClick={() => { onChange(a.id); setOpen(false) }}
              className={cn('rounded-xl border p-4 text-left transition', a.id === value ? 'border-brand-500 bg-brand-50/60' : 'border-line hover:bg-canvas')}
            >
              <AddressSummary address={a} />
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}
