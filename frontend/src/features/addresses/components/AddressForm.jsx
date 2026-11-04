import { useState } from 'react'
import { Home, Briefcase, MapPin, MapPinPlus, Plus } from 'lucide-react'
import { Input, Textarea } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { validate, required, isPhone, isPincode } from '../../../utils/bookingValidation'
import { cn } from '../../../utils/cn'
import { AddressCard, useAddresses } from './AddressCard'
import { Card, CardHeader, CardBody } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton } from '../../../components/ui/Spinner'
import { EmptyState } from '../../../components/feedback/EmptyState'
import { ErrorMessage } from '../../../components/feedback/ErrorMessage'
import { useToast } from '../../../components/feedback/Toast'
import { api } from '../../../services/api-client'

const empty = {
  label: 'HOME', recipientName: '', phone: '', addressLine1: '', addressLine2: '',
  landmark: '', city: 'Bengaluru', postalCode: '', instructions: '', isDefault: false,
}

const schema = {
  recipientName: [[required, 'Enter the name of the person handing over laundry.']],
  phone: [[required, 'Enter a phone number.'], [isPhone, 'Enter a valid 10-digit mobile number.']],
  addressLine1: [[required, 'Enter flat / house number and building.']],
  addressLine2: [[required, 'Enter street and area.']],
  city: [[required, 'Enter city.']],
  postalCode: [[required, 'Enter pincode.'], [isPincode, 'Pincode must be 6 digits.']],
}

const labels = [
  { value: 'HOME', text: 'Home', icon: Home },
  { value: 'WORK', text: 'Work', icon: Briefcase },
  { value: 'OTHER', text: 'Other', icon: MapPin },
]

export function AddressForm({ initial, onSubmit, onCancel, saving, defaultName, defaultPhone }) {
  const [values, setValues] = useState(() => ({ ...empty, recipientName: defaultName ?? '', phone: defaultPhone ?? '', ...initial }))
  const [errors, setErrors] = useState({})

  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setValues((s) => ({ ...s, [field]: v }))
    if (errors[field]) setErrors((s) => ({ ...s, [field]: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const found = validate(values, schema)
    setErrors(found)
    if (Object.keys(found).length) return
    const { id: _id, ...body } = values
    onSubmit({ ...body, phone: values.phone.replace(/\D/g, '').slice(-10), postalCode: values.postalCode.trim() })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="animate-fade-up space-y-5 rounded-xl border border-brand-200 bg-brand-50/30 p-4 sm:p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy-700">Save as</legend>
        <div className="flex gap-2">
          {labels.map(({ value, text, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-100',
                values.label === value ? 'border-brand-500 bg-white text-brand-700' : 'border-line bg-white text-navy-500 hover:text-navy-900',
              )}
            >
              <input type="radio" name="label" value={value} checked={values.label === value} onChange={set('label')} className="sr-only" />
              <Icon className="size-4" aria-hidden /> {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Contact name" required value={values.recipientName} onChange={set('recipientName')} error={errors.recipientName} autoComplete="name" />
        <Input label="Mobile number" required type="tel" inputMode="numeric" value={values.phone} onChange={set('phone')} error={errors.phone} placeholder="10-digit number" autoComplete="tel" />
        <Input label="Flat / House no., Building" required value={values.addressLine1} onChange={set('addressLine1')} error={errors.addressLine1} placeholder="A-203, Lake View Apartments" autoComplete="address-line1" className="sm:col-span-2" />
        <Input label="Street, Area / Locality" required value={values.addressLine2} onChange={set('addressLine2')} error={errors.addressLine2} placeholder="24th Main, HSR Layout" autoComplete="address-line2" className="sm:col-span-2" />
        <Input label="Landmark" value={values.landmark} onChange={set('landmark')} placeholder="Near…" hint="Helps our pickup partner find you." />
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" required value={values.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
          <Input label="Pincode" required inputMode="numeric" maxLength={6} value={values.postalCode} onChange={set('postalCode')} error={errors.postalCode} autoComplete="postal-code" />
        </div>
        <Textarea label="Default pickup instructions" value={values.instructions} onChange={set('instructions')} placeholder="Gate number, call on arrival, leave with security…" maxLength={240} className="sm:col-span-2" rows={2} />
      </div>

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" checked={values.isDefault} onChange={set('isDefault')} className="size-4 accent-brand-700" />
        Use as my default pickup address
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>Save address</Button>
      </div>
    </form>
  )
}

/** Saved pickup addresses — lives inside Profile (no separate Addresses page). */
export function AddressManager({ user }) {
  const { data, loading, error, reload } = useAddresses()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | address
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  async function save(body) {
    setSaving(true)
    try {
      if (editing === 'new') await api.createAddress(body)
      else await api.updateAddress(editing.id, body)
      toast(editing === 'new' ? 'Address added' : 'Address updated')
      setEditing(null)
      reload({ silent: true })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    try {
      await api.deleteAddress(toDelete.id)
      toast('Address removed')
      reload({ silent: true })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setToDelete(null)
    }
  }

  async function makeDefault(a) {
    await api.updateAddress(a.id, { isDefault: true })
    toast('Default address updated')
    reload({ silent: true })
  }

  return (
    <Card id="addresses" className="scroll-mt-24">
      <CardHeader
        icon={MapPinPlus}
        title="Saved pickup addresses"
        description="Where we pick up and deliver your laundry."
        action={!editing && data?.length > 0 && (
          <Button size="sm" variant="soft" onClick={() => setEditing('new')}><Plus className="size-4" /> Add</Button>
        )}
      />
      <CardBody className="space-y-3">
        {editing === 'new' && (
          <AddressForm onSubmit={save} onCancel={() => setEditing(null)} saving={saving} defaultName={user?.fullName} defaultPhone={user?.phone} />
        )}

        {loading && <><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></>}
        {error && <ErrorMessage error={error} onRetry={reload} />}

        {!loading && !error && !data?.length && editing !== 'new' && (
          <EmptyState
            icon={MapPinPlus}
            title="No saved address yet"
            description="Add one so booking a pickup takes seconds."
            action={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add address</Button>}
          />
        )}

        <div className="grid gap-3 xl:grid-cols-2">
          {data?.map((a) =>
            editing?.id === a.id ? (
              <div key={a.id} className="xl:col-span-2">
                <AddressForm initial={a} onSubmit={save} onCancel={() => setEditing(null)} saving={saving} />
              </div>
            ) : (
              <AddressCard key={a.id} address={a} onEdit={() => setEditing(a)} onDelete={() => setToDelete(a)} onMakeDefault={() => makeDefault(a)} />
            ),
          )}
        </div>
      </CardBody>

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this address?"
        description="Past orders keep their copy of the address. This can't be undone."
        footer={<>
          <Button variant="secondary" size="sm" onClick={() => setToDelete(null)}>Keep it</Button>
          <Button variant="danger" size="sm" onClick={confirmDelete}>Delete</Button>
        </>}
      >
        <p className="text-sm text-navy-700">{toDelete?.addressLine1}, {toDelete?.addressLine2}</p>
      </Modal>
    </Card>
  )
}
