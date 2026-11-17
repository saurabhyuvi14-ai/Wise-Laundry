import { z } from 'zod'
import { ApiError } from './errors.js'

const phoneRegex = /^[6-9]\d{9}$/
const postalCodeRegex = /^\d{6}$/

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    email: z.string().trim().email('Enter a valid email address').toLowerCase(),
    phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit mobile number'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    role: z.undefined({ invalid_type_error: 'Role assignment is not allowed at registration' }),
  })
  .transform((data) => ({
    ...data,
    fullName: data.fullName || data.name || '',
  }))
  .refine((data) => Boolean(data.fullName), {
    message: 'Enter your full name.',
    path: ['fullName'],
  })

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export const updateMeSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit mobile number').optional(),
  role: z.undefined({ invalid_type_error: 'Role cannot be changed' }),
}).transform((data) => ({
  ...data,
  fullName: data.fullName || data.name,
}))

export const addressSchema = z.object({
  label: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  recipientName: z.string().trim().min(2, 'Contact name is required').max(100),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit mobile number'),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required').max(200),
  addressLine2: z.string().trim().min(2, 'Street/area is required').max(200),
  landmark: z.string().trim().max(150).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(100).default('Bengaluru'),
  postalCode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  pincode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  instructions: z.string().trim().max(300).optional().default(''),
  isDefault: z.boolean().optional().default(false),
}).transform((data) => ({
  ...data,
  postalCode: data.postalCode || data.pincode || '',
})).refine((data) => Boolean(data.postalCode), {
  message: 'Pincode must be 6 digits',
  path: ['postalCode'],
})

export const updateAddressSchema = z.object({
  label: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
  recipientName: z.string().trim().min(2, 'Contact name is required').max(100).optional(),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit mobile number').optional(),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required').max(200).optional(),
  addressLine2: z.string().trim().min(2, 'Street/area is required').max(200).optional(),
  landmark: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2, 'City is required').max(100).optional(),
  postalCode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  pincode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  instructions: z.string().trim().max(300).optional(),
  isDefault: z.boolean().optional(),
}).transform((data) => ({
  ...data,
  postalCode: data.postalCode || data.pincode,
}))

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1, 'Choose a service.'),
        quantity: z.number().nullable().optional(),
      }),
    )
    .min(1, 'Choose a service.'),
  addressId: z.string().min(1, 'Choose a pickup address.'),
  pickupScheduledAt: z.string().refine((val) => {
    const d = new Date(val)
    return !isNaN(d.getTime()) && d > new Date()
  }, 'Pick a future time.'),
  pickupSlotHours: z.number().min(1).max(6).default(2),
  instructions: z.string().trim().max(500).optional().default(''),
})

export const listOrdersQuerySchema = z.object({
  status: z.enum(['all', 'active', 'past']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

/**
 * Validates data against a Zod schema and throws a structured ApiError on failure.
 */
export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const fields = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root'
      if (!fields[path]) {
        fields[path] = issue.message
      }
    }
    const firstMsg = Object.values(fields)[0] || 'Validation failed.'
    throw ApiError.badRequest(firstMsg, fields)
  }
  return result.data
}
