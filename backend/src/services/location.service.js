import { config } from '../config/env.js'
import { ApiError } from '../utils/errors.js'

const EARTH_RADIUS_KM = 6371

function toRadians(deg) {
  return (deg * Math.PI) / 180
}

export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Checks whether a pickup location (coordinates and/or city + postalCode) is within configured service area.
 */
export function checkServiceArea({ coordinates, city, postalCode } = {}) {
  const allowedCities = (config.SERVICE_AREA_CITIES || 'Bengaluru,Bangalore')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)

  const allowedPrefixes = (config.SERVICE_AREA_PINCODE_PREFIXES || '560')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
    const distKm = haversineDistanceKm(
      coordinates.lat,
      coordinates.lng,
      config.SERVICE_AREA_CENTER_LAT,
      config.SERVICE_AREA_CENTER_LNG,
    )
    if (distKm > config.SERVICE_AREA_RADIUS_KM) {
      return {
        supported: false,
        message: 'Outside our service area',
      }
    }
  }

  if (city) {
    const normalizedCity = city.trim().toLowerCase()
    if (allowedCities.length > 0 && !allowedCities.includes(normalizedCity)) {
      return {
        supported: false,
        message: 'Outside our service area',
      }
    }
  }

  if (postalCode) {
    const normalizedPin = postalCode.trim()
    if (allowedPrefixes.length > 0 && !allowedPrefixes.some((p) => normalizedPin.startsWith(p))) {
      return {
        supported: false,
        message: 'Outside our service area',
      }
    }
  }

  return {
    supported: true,
    message: null,
  }
}

export function assertServiceArea({ coordinates, city, postalCode } = {}) {
  const result = checkServiceArea({ coordinates, city, postalCode })
  if (!result.supported) {
    throw ApiError.badRequest('Outside our service area', {
      postalCode: 'Outside our service area',
    })
  }
}

function normalizeNominatimAddress(payload, lat, lng) {
  const addr = payload?.address || {}
  const road = [addr.house_number, addr.road].filter(Boolean).join(' ')
  const area = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.city_district || ''
  const addressLine2 = [road, area].filter(Boolean).join(', ')
  const city = addr.city || addr.town || addr.village || addr.state_district || addr.county || ''
  const state = addr.state || ''
  const postalCode = (addr.postcode || '').replace(/\s+/g, '').slice(0, 6)

  return {
    addressLine2,
    city,
    state,
    postalCode,
    formattedAddress: payload?.display_name || '',
    coordinates: { lat, lng },
    serviceArea: checkServiceArea({ coordinates: { lat, lng }, city, postalCode }),
  }
}

function normalizeGoogleAddress(payload, lat, lng) {
  const first = payload?.results?.[0]
  if (!first) return null
  const comps = first.address_components || []
  const pick = (...types) =>
    comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name || ''

  const street = [pick('street_number'), pick('route')].filter(Boolean).join(' ')
  const sublocality = pick('sublocality_level_1', 'sublocality', 'neighborhood')
  const addressLine2 = [street, sublocality].filter(Boolean).join(', ')
  const city = pick('locality', 'administrative_area_level_2')
  const state = pick('administrative_area_level_1')
  const postalCode = pick('postal_code').replace(/\s+/g, '').slice(0, 6)

  const loc = first.geometry?.location
  const resolvedLat = typeof loc?.lat === 'number' ? loc.lat : lat
  const resolvedLng = typeof loc?.lng === 'number' ? loc.lng : lng

  return {
    addressLine2,
    city,
    state,
    postalCode,
    formattedAddress: first.formatted_address || '',
    coordinates: { lat: resolvedLat, lng: resolvedLng },
    serviceArea: checkServiceArea({ coordinates: { lat: resolvedLat, lng: resolvedLng }, city, postalCode }),
  }
}

/**
 * Reverse-geocodes lat/lng via the configured provider (Nominatim by default, or Google Maps if configured).
 */
export async function reverseGeocode(lat, lng) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)

  try {
    if (config.GEOCODING_PROVIDER === 'google' && config.GOOGLE_MAPS_API_KEY) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('latlng', `${lat},${lng}`)
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY)

      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`Geocoding provider HTTP ${res.status}`)
      const json = await res.json()
      const normalized = normalizeGoogleAddress(json, lat, lng)
      if (!normalized) {
        throw ApiError.notFound('Could not determine address for these coordinates. Please enter it manually.')
      }
      return normalized
    }

    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('addressdetails', '1')

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': config.GEOCODING_USER_AGENT,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`)
    }

    const json = await res.json()
    if (json.error) {
      throw ApiError.notFound('Could not determine address for these coordinates. Please enter it manually.')
    }

    return normalizeNominatimAddress(json, lat, lng)
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(502, 'GEOCODING_UNAVAILABLE', 'Address lookup is temporarily unavailable. Please enter your address manually.')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Forward-geocodes a customer-edited address to refresh coordinates.
 */
export async function geocodeAddress({ addressLine2, city, state, postalCode }) {
  const query = [addressLine2, city, state, postalCode, 'India'].filter(Boolean).join(', ')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)

  try {
    if (config.GEOCODING_PROVIDER === 'google' && config.GOOGLE_MAPS_API_KEY) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('address', query)
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY)

      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`Geocoding provider HTTP ${res.status}`)
      const json = await res.json()
      const normalized = normalizeGoogleAddress(json, null, null)
      if (!normalized || normalized.coordinates.lat == null) {
        return {
          coordinates: null,
          serviceArea: checkServiceArea({ city, postalCode }),
        }
      }
      return {
        coordinates: normalized.coordinates,
        serviceArea: checkServiceArea({ coordinates: normalized.coordinates, city, postalCode }),
      }
    }

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '1')

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': config.GEOCODING_USER_AGENT,
        Accept: 'application/json',
      },
    })

    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
    const results = await res.json()
    const first = Array.isArray(results) ? results[0] : null
    if (!first) {
      return {
        coordinates: null,
        serviceArea: checkServiceArea({ city, postalCode }),
      }
    }

    const coords = { lat: Number(first.lat), lng: Number(first.lon) }
    return {
      coordinates: Number.isFinite(coords.lat) && Number.isFinite(coords.lng) ? coords : null,
      serviceArea: checkServiceArea({ coordinates: coords, city, postalCode }),
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(502, 'GEOCODING_UNAVAILABLE', 'Could not verify coordinates for this address.')
  } finally {
    clearTimeout(timer)
  }
}
