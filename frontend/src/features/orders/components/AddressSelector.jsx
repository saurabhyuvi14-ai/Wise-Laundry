import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Briefcase, MapPin, Plus, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Spinner'
import { ADDRESS_LABELS, formatAddress } from '../../addresses/components/AddressCard'
import { AddressForm } from '../../addresses/components/AddressForm'
import { LocationPromptModal } from '../../addresses/components/LocationPromptModal'
import { useGeolocation } from '../../addresses/hooks/useGeolocation'
import { useAuth } from '../../auth/hooks/useAuth'
import { useToast } from '../../../components/feedback/Toast'
import { api } from '../../../services/api-client'
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

export function AddressSelector({ addresses, loading, value, onChange, onReloadAddresses, error }) {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | address
  const [detectedDraft, setDetectedDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const { detecting, error: geoError, detectLocation, cancel: cancelGeo } = useGeolocation()
  const selected = addresses?.find((a) => a.id === value)

  function startAddAddress() {
    setOpen(false)
    setDetectedDraft(null)
    setServerErrors(null)
    cancelGeo()
    setPromptOpen(true)
  }

  async function handleUseLocation() {
    const res = await detectLocation()
    if (res?.cancelled) return
    if (res?.ok) {
      setDetectedDraft({ ...res.data, notice: res.notice })
      setPromptOpen(false)
      setEditing('new')
    }
  }

  function handleClosePrompt() {
    cancelGeo()
    setPromptOpen(false)
    setDetectedDraft(null)
    setEditing('new')
  }

  async function handleSaveAddress(body) {
    setSaving(true)
    setServerErrors(null)
    try {
      let saved
      if (editing === 'new') {
        const res = await api.createAddress(body)
        saved = res.data
      } else {
        const res = await api.updateAddress(editing.id, body)
        saved = res.data
      }
      toast(editing === 'new' ? 'Address added' : 'Address updated')
      setEditing(null)
      setDetectedDraft(null)
      await onReloadAddresses?.({ silent: true })
      if (saved?.id) onChange(saved.id)
    } catch (err) {
      if (err.fields) setServerErrors(err.fields)
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await api.deleteAddress(toDelete.id)
      toast('Address removed')
      if (value === toDelete.id) onChange('')
      await onReloadAddresses?.({ silent: true })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setToDelete(null)
    }
  }

  if (loading) return <Skeleton className="h-20 rounded-xl" />

  return (
    <>
      {!addresses?.length ? (
        <div className="rounded-xl border border-dashed border-line p-5 text-center">
          <p className="text-sm text-navy-500">You have no saved pickup address yet.</p>
          <Button type="button" onClick={startAddAddress} variant="soft" size="sm" className="mt-3">
            <Plus className="size-4" /> Add Address
          </Button>
        </div>
      ) : (
        <>
          <div className={cn('flex items-start justify-between gap-4 rounded-xl border p-4', error ? 'border-red-400' : 'border-line')}>
            {selected ? <AddressSummary address={selected} /> : <p className="text-sm text-navy-500">Choose where we should pick up.</p>}
            <div className="flex shrink-0 items-center gap-3">
              <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
                {selected ? 'Change' : 'Choose'}
              </button>
              <button type="button" onClick={startAddAddress} className="text-sm font-semibold text-navy-600 underline-offset-4 hover:text-brand-700 hover:underline">
                + Add Address
              </button>
            </div>
          </div>
          <p className={cn('mt-3 text-sm', error ? 'font-medium text-red-600' : 'text-navy-500')}>
            {error ?? (
              <>Manage saved addresses here or in <Link to="/customer/profile#addresses" className="font-medium text-brand-700 underline underline-offset-4">Profile</Link>.</>
            )}
          </p>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pickup address"
        description="Choose, edit, or add a saved address."
        footer={
          <Button type="button" variant="secondary" size="sm" onClick={startAddAddress}>
            <Plus className="size-4" /> Add Address
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Saved addresses">
          {addresses?.map((a) => (
            <div
              key={a.id}
              className={cn('rounded-xl border p-3.5 transition', a.id === value ? 'border-brand-500 bg-brand-50/60' : 'border-line hover:bg-canvas')}
            >
              <button
                type="button"
                role="radio"
                aria-checked={a.id === value}
                onClick={() => { onChange(a.id); setOpen(false) }}
                className="w-full text-left"
              >
                <AddressSummary address={a} />
              </button>
              <div className="mt-2.5 flex justify-end gap-2 border-t border-line/60 pt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setServerErrors(null); setEditing(a) }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-white"
                >
                  <Pencil className="size-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setToDelete(a) }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <LocationPromptModal
        open={promptOpen}
        detecting={detecting}
        error={geoError}
        onUseLocation={handleUseLocation}
        onClose={handleClosePrompt}
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => { setEditing(null); setDetectedDraft(null); setServerErrors(null) }}
        title={editing === 'new' ? 'Add pickup address' : 'Edit pickup address'}
        description="Confirm your address details below."
      >
        {editing && (
          <AddressForm
            initial={editing === 'new' ? undefined : editing}
            detectedLocation={editing === 'new' ? detectedDraft : undefined}
            onSubmit={handleSaveAddress}
            onCancel={() => { setEditing(null); setDetectedDraft(null); setServerErrors(null) }}
            saving={saving}
            defaultName={user?.fullName}
            defaultPhone={user?.phone}
            serverErrors={serverErrors}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this address?"
        description="Past orders keep their copy of the address. This can't be undone."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setToDelete(null)}>Keep it</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">{toDelete?.addressLine1}, {toDelete?.addressLine2}</p>
      </Modal>
    </>
  )
}
