import * as addressService from '../services/address.service.js'
import { addressSchema, updateAddressSchema, validate } from '../utils/validation.js'

export async function listAddresses(req, res, next) {
  try {
    const list = await addressService.listAddresses(req.user._id)
    return res.json({ data: list })
  } catch (err) {
    next(err)
  }
}

export async function createAddress(req, res, next) {
  try {
    const data = validate(addressSchema, req.body)
    const address = await addressService.createAddress(req.user._id, data)
    return res.status(201).json({ data: address })
  } catch (err) {
    next(err)
  }
}

export async function updateAddress(req, res, next) {
  try {
    const data = validate(updateAddressSchema, req.body)
    const address = await addressService.updateAddress(req.user._id, req.params.id, data)
    return res.json({ data: address })
  } catch (err) {
    next(err)
  }
}

export async function deleteAddress(req, res, next) {
  try {
    await addressService.deleteAddress(req.user._id, req.params.id)
    return res.status(204).end()
  } catch (err) {
    next(err)
  }
}

