import { SlotCapacity } from '../models/SlotCapacity.js'
import { config } from '../config/env.js'

export const STANDARD_SLOTS = [8, 10, 12, 14, 16, 18, 20]

export async function getSlots(dateStr = new Date().toISOString().split('T')[0]) {
  const maxCapacity = config?.DEFAULT_SLOT_CAPACITY || 5
  return Promise.all(
    STANDARD_SLOTS.map((hour) => SlotCapacity.getSlotAvailability(dateStr, hour, maxCapacity)),
  )
}

export async function reserveSlot(dateStr, slotHour) {
  const maxCapacity = config?.DEFAULT_SLOT_CAPACITY || 5
  return SlotCapacity.reserveSlot(dateStr, slotHour, maxCapacity)
}

export async function releaseSlot(dateStr, slotHour) {
  return SlotCapacity.releaseSlot(dateStr, slotHour)
}

