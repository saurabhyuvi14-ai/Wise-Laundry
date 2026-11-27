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

export const googleSignInSchema = z.object({
  credential: z.string().trim().min(20, 'Google sign-in failed. Please try again.'),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit mobile number').optional(),
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

const coordinatesSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .nullable()
  .optional()

export const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
  lng: z.coerce.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
})

export const geocodeAddressSchema = z.object({
  addressLine2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(100),
  state: z.string().trim().max(100).optional().default(''),
  postalCode: z.string().trim().max(12).optional().default(''),
})

export const addressSchema = z.object({
  label: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  recipientName: z.string().trim().min(2, 'Contact name is required').max(100),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid 10-digit mobile number'),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required').max(200),
  addressLine2: z.string().trim().min(2, 'Street/area is required').max(200),
  landmark: z.string().trim().max(150).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(100).default('Bengaluru'),
  state: z.string().trim().max(100).optional().default(''),
  postalCode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  pincode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  coordinates: coordinatesSchema,
  locationAccuracyMeters: z.number().nonnegative().nullable().optional(),
  locationSource: z.enum(['GEOLOCATION', 'GEOCODED', 'MANUAL']).optional().default('MANUAL'),
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
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  pincode: z.string().trim().regex(postalCodeRegex, 'Pincode must be 6 digits').optional(),
  coordinates: coordinatesSchema,
  locationAccuracyMeters: z.number().nonnegative().nullable().optional(),
  locationSource: z.enum(['GEOLOCATION', 'GEOCODED', 'MANUAL']).optional(),
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
  express: z.boolean().optional().default(false),
})

export const cancelOrderSchema = z.object({
  reason: z.enum(['CHANGE_OF_PLANS', 'NOT_AVAILABLE_AT_PICKUP', 'BOOKED_BY_MISTAKE', 'WANT_DIFFERENT_SERVICE', 'OTHER'], {
    errorMap: () => ({ message: 'Choose a reason.' }),
  }),
  note: z.string().trim().max(300).optional().default(''),
})

export const rescheduleOrderSchema = z.object({
  pickupScheduledAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Pick a valid time.'),
  pickupSlotHours: z.number().min(1).max(6).optional(),
})

export const saveBillSchema = z.object({
  quantity: z.coerce.number({ invalid_type_error: 'Enter a number.' }),
  note: z.string().trim().max(200).optional().default(''),
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


export const FEEDBACK_TAGS = ['CLEAN_FRESH', 'NEATLY_FOLDED', 'ON_TIME', 'POLITE_RIDER', 'GOOD_VALUE', 'STAINS_LEFT', 'ITEM_MISSING', 'DAMAGED', 'LATE', 'WRONG_ITEMS']
export const ISSUE_TYPES = ['ITEM_MISSING', 'DAMAGED', 'STAINS_LEFT', 'WRONG_ITEMS', 'LATE_DELIVERY', 'BILLING', 'OTHER']

export const feedbackSchema = z
  .object({
    rating: z.number({ invalid_type_error: 'Pick a star rating.', required_error: 'Pick a star rating.' }).int().min(1, 'Pick a star rating.').max(5),
    tags: z.array(z.enum(FEEDBACK_TAGS)).max(FEEDBACK_TAGS.length).optional().default([]),
    comment: z.string().trim().max(500).optional().default(''),
    issue: z
      .object({
        type: z.enum(ISSUE_TYPES, { errorMap: () => ({ message: 'Choose what went wrong.' }) }),
        note: z.string().trim().max(500).optional().default(''),
      })
      .nullable()
      .optional()
      .default(null),
  })
  .refine((d) => !d.issue || d.issue.type !== 'OTHER' || d.issue.note.length > 0, { message: 'Tell us what went wrong.', path: ['issue', 'note'] })

export const expressSwitchSchema = z.object({
  express: z.boolean({ required_error: 'Choose standard or express.', invalid_type_error: 'Choose standard or express.' }),
})

export const advanceStatusSchema = z.object({
  from: z.string({ required_error: 'Missing current status.' }).min(1),
})
