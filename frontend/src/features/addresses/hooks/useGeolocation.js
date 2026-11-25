import { useCallback, useRef, useState } from 'react'
import { api } from '../../../services/api-client'

/**
 * One-shot browser geolocation + Express reverse-geocoding hook.
 * Fetches a fresh position once per explicit user action, handles denied/expired
 * permissions and unsupported permissions APIs gracefully, and ignores stale
 * delayed responses if cancelled or superseded.
 */
export function useGeolocation() {
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState(null)
  const activeRequestId = useRef(0)

  const cancel = useCallback(() => {
    activeRequestId.current += 1
    setDetecting(false)
    setError(null)
  }, [])

  const detectLocation = useCallback(async () => {
    const requestId = ++activeRequestId.current
    setDetecting(true)
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const msg = 'Location detection is not supported by your browser. Please enter your address manually.'
      setDetecting(false)
      setError(msg)
      return { ok: false, error: msg }
    }

    // Check Permissions API gracefully (not supported on all browsers, e.g. older iOS Safari)
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' })
        if (requestId !== activeRequestId.current) return { ok: false, cancelled: true }
        if (status.state === 'denied') {
          const msg = 'Location access is blocked in your browser settings. Please allow location access or enter your address manually.'
          setDetecting(false)
          setError(msg)
          return { ok: false, denied: true, error: msg }
        }
      }
    } catch {
      // Ignore unsupported Permissions API errors and let getCurrentPosition prompt natively
    }

    let position
    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // always fetch a fresh position per action
        })
      })
    } catch (geoErr) {
      if (requestId !== activeRequestId.current) return { ok: false, cancelled: true }
      let msg = 'Could not detect your location. Please enter your address manually.'
      if (geoErr?.code === 1) {
        msg = 'Location permission was denied. You can still enter your address manually.'
      } else if (geoErr?.code === 2) {
        msg = 'Your location is currently unavailable. Please enter your address manually.'
      } else if (geoErr?.code === 3) {
        msg = 'Location request timed out. Please try again or enter your address manually.'
      }
      setDetecting(false)
      setError(msg)
      return { ok: false, denied: geoErr?.code === 1, timeout: geoErr?.code === 3, error: msg }
    }

    if (requestId !== activeRequestId.current) {
      return { ok: false, cancelled: true }
    }

    const lat = position.coords.latitude
    const lng = position.coords.longitude
    const accuracyMeters = Number.isFinite(position.coords.accuracy)
      ? Math.round(position.coords.accuracy)
      : null

    try {
      const res = await api.reverseGeocode({ lat, lng })
      if (requestId !== activeRequestId.current) return { ok: false, cancelled: true }
      setDetecting(false)
      return {
        ok: true,
        data: {
          ...res.data,
          coordinates: res.data?.coordinates ?? { lat, lng },
          locationAccuracyMeters: accuracyMeters,
          locationSource: 'GEOLOCATION',
        },
      }
    } catch (lookupErr) {
      if (requestId !== activeRequestId.current) return { ok: false, cancelled: true }
      setDetecting(false)
      const msg = lookupErr?.message || 'We found your coordinates, but could not look up the street address. Please fill in your address details below.'
      return {
        ok: true,
        lookupFailed: true,
        notice: msg,
        data: {
          addressLine2: '',
          city: '',
          state: '',
          postalCode: '',
          coordinates: { lat, lng },
          locationAccuracyMeters: accuracyMeters,
          locationSource: 'GEOLOCATION',
          serviceArea: { supported: true, message: null },
        },
      }
    }
  }, [])

  return { detecting, error, detectLocation, cancel, clearError: () => setError(null) }
}
