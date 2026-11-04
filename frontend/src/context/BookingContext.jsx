import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// Only the unsent booking draft lives here (non-sensitive, sessionStorage).
const DRAFT_KEY = 'wise-laundry-booking-draft'
const emptyDraft = () => ({
  serviceId: null,
  addressId: null,
  date: null, // 'YYYY-MM-DD'
  slotHour: null, // 24h start hour of a 2-hour requested window
  instructions: '',
  idempotencyKey: crypto.randomUUID(),
})

function readDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) return { ...emptyDraft(), ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return emptyDraft()
}

const BookingContext = createContext(null)

export function BookingProvider({ children }) {
  const [draft, setDraft] = useState(readDraft)

  const update = useCallback((patch) => {
    setDraft((d) => {
      // A changed booking is a new attempt -> new idempotency key.
      const next = { ...d, ...patch, idempotencyKey: crypto.randomUUID() }
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setDraft(emptyDraft())
  }, [])

  const value = useMemo(() => ({ draft, update, clear }), [draft, update, clear])
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

export const useBookingDraft = () => useContext(BookingContext)
