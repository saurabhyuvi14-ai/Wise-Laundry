import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServices } from '../../services/components/ServiceList'
import { useAddresses } from '../../addresses/components/AddressCard'
import { useBookingDraft } from '../../../context/BookingContext'
import { useToast } from '../../../components/feedback/Toast'
import { SLOT_HOURS, toPickupIso } from '../components/PickupSchedule'
import { api } from '../../../services/api-client'

/**
 * Booking flow state: catalogue + saved addresses + unsent draft + submit.
 * Keeps the draft on failure, blocks double submit, sends an idempotency key (guide §5).
 */
export function useBooking() {
  const navigate = useNavigate()
  const toast = useToast()
  const { draft, update, clear } = useBookingDraft()
  const services = useServices()
  const addresses = useAddresses()
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  // Pre-select the default saved address.
  useEffect(() => {
    const list = addresses.data
    if (!list?.length) return
    if (!draft.addressId || !list.some((a) => a.id === draft.addressId)) {
      update({ addressId: (list.find((a) => a.isDefault) ?? list[0]).id })
    }
  }, [addresses.data, draft.addressId, update])

  const service = services.data?.find((s) => s.id === draft.serviceId)
  const address = addresses.data?.find((a) => a.id === draft.addressId)
  const scheduled = Boolean(draft.date && draft.slotHour != null)
  const stepsDone = [service, address, scheduled].filter(Boolean).length

  async function submit() {
    if (submitting || stepsDone < 3) return
    setSubmitting(true)
    setErrors({})
    try {
      const res = await api.createOrder(
        {
          items: [{ serviceId: draft.serviceId }], // quantity is confirmed by staff after pickup
          addressId: draft.addressId,
          pickupScheduledAt: toPickupIso(draft.date, draft.slotHour),
          pickupSlotHours: SLOT_HOURS,
          instructions: draft.instructions,
          express: Boolean(draft.express && service?.express),
        },
        draft.idempotencyKey,
      )
      clear()
      navigate(`/customer/orders/${res.data.id}/confirmation`, { replace: true })
    } catch (err) {
      // Draft is kept so nothing the customer entered is lost.
      setErrors(err.fields ?? {})
      toast(err.message ?? 'Could not book. Please retry.', 'error')
      setSubmitting(false)
    }
  }

  return {
    draft,
    update,
    services,
    addresses,
    reloadAddresses: addresses.reload,
    service,
    address,
    scheduled,
    stepsDone,
    submitting,
    errors,
    submit,
  }
}

/**
 * "Book again": copy service, address and instructions from a past order into the
 * booking draft, then open Book a Pickup so the customer only picks a new time.
 * Older orders don't store the address id, so match the saved copy of the address.
 */
export function useBookAgain() {
  const { update } = useBookingDraft()
  const navigate = useNavigate()

  return useCallback(
    (order, savedAddresses = []) => {
      const snap = order.addressSnapshot || {}
      const same = (a) =>
        a.addressLine1 === snap.addressLine1 && a.postalCode === snap.postalCode && (a.label === snap.label || !snap.label)
      const address = savedAddresses.find((a) => a.id === order.addressId) || savedAddresses.find(same)
      update({
        serviceId: order.items[0].serviceId,
        addressId: address?.id ?? null,
        instructions: order.instructions || '',
        express: Boolean(order.express),
        date: null,
        slotHour: null,
      })
      navigate(`/customer/book?again=${encodeURIComponent(order.reference)}`)
    },
    [update, navigate],
  )
}
