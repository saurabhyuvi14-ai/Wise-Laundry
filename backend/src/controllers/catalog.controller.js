import * as catalogService from '../services/catalog.service.js'

export async function listServices(_req, res, next) {
  try {
    const services = await catalogService.listServices()
    return res.json({ data: services })
  } catch (err) {
    next(err)
  }
}
