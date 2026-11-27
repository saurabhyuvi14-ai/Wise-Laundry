import { Service } from '../models/Service.js'
import { expressFor } from './billing.service.js'

export async function listServices() {
  const list = await Service.find({ active: true }).sort({ unitPricePaise: 1 })
  return list.map((s) => ({ ...s.toJSON(), express: expressFor(s) }))
}

export async function getServiceByIdOrCode(idOrCode) {
  return Service.findOne({
    $or: [{ serviceId: idOrCode }, { code: idOrCode }],
    active: true,
  })
}

