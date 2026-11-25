import { useEffect, useRef, useState } from 'react'
import { Home, Briefcase, MapPin, MapPinPlus, Plus, Navigation, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Input, Textarea } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { validate, required, isPhone, isPincode } from '../../../utils/bookingValidation'
import { cn } from '../../../utils/cn'
import { AddressCard, useAddresses } from './AddressCard'
import { LocationPromptModal } from './LocationPromptModal'
import { useGeolocation } from '../hooks/useGeolocation'
import { Card, CardHeader, CardBody } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton } from '../../../components/ui/Spinner'
import { EmptyState } from '../../../components/feedback/EmptyState'
import { ErrorMessage } from '../../../components/feedback/ErrorMessage'
import { useToast } from '../../../components/feedback/Toast'
import { api } from '../../../services/api-client'

const empty = {
  label: 'HOME',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '',
  instructions: '',
  isDefault: false,
  coordinates: null,
  locationAccuracyMeters: null,
  locationSource: 'MANUAL',
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

const LOCALITY_FIELDS = new Set(['addressLine2', 'city', 'state', 'postalCode'])

export function AddressForm({ initial, detectedLocation, onSubmit, onCancel, saving, defaultName, defaultPhone, serverErrors }) {
  const [values, setValues] = useState(() => ({
    ...empty,
    recipientName: defaultName ?? '',
    phone: defaultPhone ?? '',
    ...initial,
    ...(detectedLocation
      ? {
          addressLine2: detectedLocation.addressLine2 || initial?.addressLine2 || '',
          city: detectedLocation.city || initial?.city || empty.city,
          state: detectedLocation.state || initial?.state || empty.state,
          postalCode: detectedLocation.postalCode || initial?.postalCode || '',
          coordinates: detectedLocation.coordinates ?? null,
          locationAccuracyMeters: detectedLocation.locationAccuracyMeters ?? null,
          locationSource: detectedLocation.locationSource || 'GEOLOCATION',
        }
      : {}),
  }))
  const [errors, setErrors] = useState({})
  const [serviceAreaWarning, setServiceAreaWarning] = useState(
    detectedLocation?.serviceArea?.supported === false ? detectedLocation.serviceArea.message : null,
  )
  const [locationNotice, setLocationNotice] = useState(detectedLocation?.notice || null)
  const [stalePinCleared, setStalePinCleared] = useState(false)
  const [updatingPin, setUpdatingPin] = useState(false)

  const dirtyFieldsRef = useRef(new Set())
  const { detecting, error: geoError, detectLocation, cancel: cancelGeo } = useGeolocation()

  useEffect(() => () => cancelGeo(), [cancelGeo])

  useEffect(() => {
    if (serverErrors && Object.keys(serverErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...serverErrors }))
    }
  }, [serverErrors])

  const applyDetectedPayload = (loc, noticeMsg) => {
    if (!loc) return
    setValues((prev) => {
      const next = { ...prev }
      if (!dirtyFieldsRef.current.has('addressLine2') && loc.addressLine2) next.addressLine2 = loc.addressLine2
      if (!dirtyFieldsRef.current.has('city') && loc.city) next.city = loc.city
      if (!dirtyFieldsRef.current.has('state') && loc.state) next.state = loc.state
      if (!dirtyFieldsRef.current.has('postalCode') && loc.postalCode) next.postalCode = loc.postalCode
      next.coordinates = loc.coordinates ?? null
      next.locationAccuracyMeters = loc.locationAccuracyMeters ?? null
      next.locationSource = loc.locationSource || 'GEOLOCATION'
      return next
    })
    setServiceAreaWarning(loc.serviceArea?.supported === false ? loc.serviceArea.message : null)
    setLocationNotice(noticeMsg || null)
    setStalePinCleared(false)
  }

  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    dirtyFieldsRef.current.add(field)
    setValues((s) => {
      const next = { ...s, [field]: v }
      if (LOCALITY_FIELDS.has(field) && s.coordinates) {
        next.coordinates = null
        next.locationAccuracyMeters = null
        next.locationSource = 'MANUAL'
        setStalePinCleared(true)
        setServiceAreaWarning(null)
      }
      return next
    })
    if (errors[field]) setErrors((s) => ({ ...s, [field]: undefined }))
  }

  async function handleRedetect() {
    dirtyFieldsRef.current.delete('addressLine2')
    dirtyFieldsRef.current.delete('city')
    dirtyFieldsRef.current.delete('state')
    dirtyFieldsRef.current.delete('postalCode')
    const res = await detectLocation()
    if (res?.ok && res.data) {
      applyDetectedPayload(res.data, res.notice)
    }
  }

  async function handleUpdatePinFromAddress() {
    if (!values.city?.trim()) {
      setErrors((e) => ({ ...e, city: 'Enter city to update location pin.' }))
      return
    }
    setUpdatingPin(true)
    setLocationNotice(null)
    try {
      const res = await api.geocodeAddress({
        addressLine2: values.addressLine2,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,
      })
      const coords = res.data?.coordinates ?? null
      setValues((s) => ({
        ...s,
        coordinates: coords,
        locationAccuracyMeters: null,
        locationSource: coords ? 'GEOCODED' : 'MANUAL',
      }))
      setStalePinCleared(false)
      setServiceAreaWarning(res.data?.serviceArea?.supported === false ? res.data.serviceArea.message : null)
      if (!coords) {
        setLocationNotice('Could not pinpoint coordinates for this edited address, but you can still save it manually.')
      }
    } catch (err) {
      setLocationNotice(err.message || 'Could not update pin for this address. You can still save manually.')
    } finally {
      setUpdatingPin(false)
    }
  }

  function handleClearPin() {
    setValues((s) => ({
      ...s,
      coordinates: null,
      locationAccuracyMeters: null,
      locationSource: 'MANUAL',
    }))
    setStalePinCleared(false)
    setServiceAreaWarning(null)
    setLocationNotice('Location pin cleared. Your written address will be used.')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const found = validate(values, schema)
    setErrors(found)
    if (Object.keys(found).length) return
    const { id: _id, pincode: _pin, ...body } = values
    onSubmit({
      ...body,
      phone: values.phone.replace(/\D/g, '').slice(-10),
      postalCode: values.postalCode.trim(),
      state: values.state?.trim() || '',
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="animate-fade-up space-y-5 rounded-xl border border-brand-200 bg-brand-50/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="min-w-0">
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

        <Button type="button" variant="secondary" size="sm" onClick={handleRedetect} loading={detecting}>
          <Navigation className="size-3.5" /> {values.coordinates ? 'Detect again' : 'Use My Current Location'}
        </Button>
      </div>

      {serviceAreaWarning && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{serviceAreaWarning}</p>
            <p className="mt-0.5 text-xs font-normal text-red-600">We currently serve Bengaluru (560xxx). Correct the area/pincode if the detected point was inaccurate.</p>
          </div>
        </div>
      )}

      {(geoError || locationNotice) && (
        <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
          {geoError || locationNotice}
        </p>
      )}

      {values.coordinates && !serviceAreaWarning && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-navy-700">
            <CheckCircle2 className="size-4 shrink-0 text-brand-700" />
            <span>
              <strong>{values.locationSource === 'GEOCODED' ? 'Updated location pin' : 'Detected location'}</strong>
              {values.locationAccuracyMeters != null && ` (~${values.locationAccuracyMeters}m accuracy)`}
              {' · '}
              <span className="text-navy-500">Review and confirm details below</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearPin}
            className="inline-flex items-center gap-1 font-semibold text-navy-500 hover:text-red-600"
          >
            <X className="size-3.5" /> Clear pin
          </button>
        </div>
      )}

      {stalePinCleared && !values.coordinates && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-navy-600">
          <span>Location pin cleared because the address changed.</span>
          <button
            type="button"
            onClick={handleUpdatePinFromAddress}
            disabled={updatingPin}
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
          >
            <RefreshCw className={cn('size-3.5', updatingPin && 'animate-spin')} /> {updatingPin ? 'Updating pin…' : 'Update pin from address'}
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Contact name" required value={values.recipientName} onChange={set('recipientName')} error={errors.recipientName} autoComplete="name" />
        <Input label="Mobile number" required type="tel" inputMode="numeric" value={values.phone} onChange={set('phone')} error={errors.phone} placeholder="10-digit number" autoComplete="tel" />
        <Input label="Flat / House no., Building" required value={values.addressLine1} onChange={set('addressLine1')} error={errors.addressLine1} placeholder="A-203, Lake View Apartments" autoComplete="address-line1" className="sm:col-span-2" />
        <Input label="Street, Area / Locality" required value={values.addressLine2} onChange={set('addressLine2')} error={errors.addressLine2} placeholder="24th Main, HSR Layout" autoComplete="address-line2" className="sm:col-span-2" />
        <Input label="Landmark" value={values.landmark} onChange={set('landmark')} placeholder="Near…" hint="Helps our pickup partner find you." />
        <Input label="State" value={values.state} onChange={set('state')} error={errors.state} placeholder="Karnataka" autoComplete="address-level1" />
        <Input label="City" required value={values.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
        <Input label="Pincode" required inputMode="numeric" maxLength={6} value={values.postalCode} onChange={set('postalCode')} error={errors.postalCode} autoComplete="postal-code" />
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
  const [promptOpen, setPromptOpen] = useState(false)
  const [detectedDraft, setDetectedDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const { detecting, error: geoError, detectLocation, cancel: cancelGeo } = useGeolocation()

  function startAddAddress() {
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

  async function save(body) {
    setSaving(true)
    setServerErrors(null)
    try {
      if (editing === 'new') await api.createAddress(body)
      else await api.updateAddress(editing.id, body)
      toast(editing === 'new' ? 'Address added' : 'Address updated')
      setEditing(null)
      setDetectedDraft(null)
      reload({ silent: true })
    } catch (err) {
      if (err.fields) setServerErrors(err.fields)
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
          <Button size="sm" variant="soft" onClick={startAddAddress}><Plus className="size-4" /> Add Address</Button>
        )}
      />
      <CardBody className="space-y-3">
        {editing === 'new' && (
          <AddressForm
            detectedLocation={detectedDraft}
            onSubmit={save}
            onCancel={() => { setEditing(null); setDetectedDraft(null); setServerErrors(null) }}
            saving={saving}
            defaultName={user?.fullName}
            defaultPhone={user?.phone}
            serverErrors={serverErrors}
          />
        )}

        {loading && <><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></>}
        {error && <ErrorMessage error={error} onRetry={reload} />}

        {!loading && !error && !data?.length && editing !== 'new' && (
          <EmptyState
            icon={MapPinPlus}
            title="No saved address yet"
            description="Add one so booking a pickup takes seconds."
            action={<Button onClick={startAddAddress}><Plus className="size-4" /> Add Address</Button>}
          />
        )}

        <div className="grid gap-3 xl:grid-cols-2">
          {data?.map((a) =>
            editing?.id === a.id ? (
              <div key={a.id} className="xl:col-span-2">
                <AddressForm
                  initial={a}
                  onSubmit={save}
                  onCancel={() => { setEditing(null); setServerErrors(null) }}
                  saving={saving}
                  serverErrors={serverErrors}
                />
              </div>
            ) : (
              <AddressCard key={a.id} address={a} onEdit={() => { setServerErrors(null); setEditing(a) }} onDelete={() => setToDelete(a)} onMakeDefault={() => makeDefault(a)} />
            ),
          )}
        </div>
      </CardBody>

      <LocationPromptModal
        open={promptOpen}
        detecting={detecting}
        error={geoError}
        onUseLocation={handleUseLocation}
        onClose={handleClosePrompt}
      />

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
