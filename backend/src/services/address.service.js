import { Address } from '../models/Address.js'
import { enforceOwnership } from '../middleware/auth.js'
import { ApiError } from '../utils/errors.js'
import { assertServiceArea } from './location.service.js'

export async function listAddresses(userId) {
  const list = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 })
  return list.map((a) => a.toJSON())
}

export async function createAddress(userId, data) {
  assertServiceArea({
    coordinates: data.coordinates,
    city: data.city,
    postalCode: data.postalCode,
  })

  const count = await Address.countDocuments({ userId })
  const isFirst = count === 0
  const shouldBeDefault = data.isDefault || isFirst

  if (shouldBeDefault) {
    await Address.updateMany({ userId }, { isDefault: false })
  }

  const address = new Address({
    userId,
    label: data.label,
    recipientName: data.recipientName,
    phone: data.phone,
    landmark: data.landmark,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    locationAccuracyMeters: data.coordinates ? (data.locationAccuracyMeters ?? null) : null,
    locationSource: data.coordinates ? (data.locationSource || 'MANUAL') : 'MANUAL',
    isDefault: shouldBeDefault,
  })

  address.setSensitiveData({
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    instructions: data.instructions,
    coordinates: data.coordinates ?? null,
  })

  await address.save()
  return address.toJSON()
}

export async function updateAddress(userId, addressId, data) {
  const address = await Address.findById(addressId)
  if (!address) {
    throw ApiError.notFound('Address not found.')
  }

  enforceOwnership(address.userId, userId)

  const currentSnapshot = address.getDecryptedSnapshot()
  const nextCity = data.city ?? currentSnapshot.city
  const nextPostalCode = data.postalCode ?? currentSnapshot.postalCode
  const nextCoordinates = data.coordinates !== undefined ? data.coordinates : currentSnapshot.coordinates

  assertServiceArea({
    coordinates: nextCoordinates,
    city: nextCity,
    postalCode: nextPostalCode,
  })

  if (data.isDefault) {
    await Address.updateMany({ userId }, { isDefault: false })
    address.isDefault = true
  } else if (data.isDefault === false && address.isDefault) {
    address.isDefault = false
  }

  if (data.label) address.label = data.label
  if (data.recipientName) address.recipientName = data.recipientName
  if (data.phone) address.phone = data.phone
  if (data.landmark !== undefined) address.landmark = data.landmark
  if (data.city) address.city = data.city
  if (data.state !== undefined) address.state = data.state
  if (data.postalCode) address.postalCode = data.postalCode

  if (data.coordinates !== undefined) {
    address.locationAccuracyMeters = data.coordinates ? (data.locationAccuracyMeters ?? null) : null
    address.locationSource = data.coordinates ? (data.locationSource || 'MANUAL') : 'MANUAL'
  } else if (data.locationSource) {
    address.locationSource = data.locationSource
  }

  address.setSensitiveData({
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    instructions: data.instructions,
    coordinates: data.coordinates,
  })

  await address.save()
  return address.toJSON()
}

export async function deleteAddress(userId, addressId) {
  const address = await Address.findById(addressId)
  if (!address) {
    throw ApiError.notFound('Address not found.')
  }

  enforceOwnership(address.userId, userId)

  const wasDefault = address.isDefault
  await address.deleteOne()

  if (wasDefault) {
    const nextDefault = await Address.findOne({ userId }).sort({ createdAt: -1 })
    if (nextDefault) {
      nextDefault.isDefault = true
      await nextDefault.save()
    }
  }

  return true
}

