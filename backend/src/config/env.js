import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const isTest = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'))

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(isTest ? 'test' : 'development'),
  MONGODB_URI: z.string({
    required_error: 'MONGODB_URI is required for connecting to MongoDB Atlas.',
  }).min(1, 'MONGODB_URI cannot be empty.'),
  MONGODB_TEST_URI: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters long for AES-256-GCM.'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long for session token security.'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(20),
  DEFAULT_SLOT_CAPACITY: z.coerce.number().default(5),
  // OAuth client ID from Google Cloud Console. Leave empty to switch Google sign-in off.
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim().replace(/^["']|["']$/g, '').trim()),
  // Location & Reverse-Geocoding
  GEOCODING_PROVIDER: z.enum(['nominatim', 'google']).default('nominatim'),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  GEOCODING_USER_AGENT: z.string().default('WiseLaundry/1.0 (support@wiselaundry.in)'),
  // Service Area Availability
  SERVICE_AREA_CITIES: z.string().default('Bengaluru,Bangalore'),
  SERVICE_AREA_PINCODE_PREFIXES: z.string().default('560'),
  SERVICE_AREA_CENTER_LAT: z.coerce.number().default(12.9716),
  SERVICE_AREA_CENTER_LNG: z.coerce.number().default(77.5946),
  SERVICE_AREA_RADIUS_KM: z.coerce.number().default(35),
})

let parsed = envSchema.safeParse(process.env)

if (!parsed.success && isTest) {
  parsed = envSchema.safeParse({
    ...process.env,
    NODE_ENV: 'test',
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wise_laundry_test',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'wise_laundry_super_secret_encryption_key_32_bytes_min',
    SESSION_SECRET: process.env.SESSION_SECRET || 'wise_laundry_session_secret_change_me_in_production_min_32',
  })
}

if (!parsed.success) {
  console.error('❌ Invalid Environment Configuration:', parsed.error.format())
  console.error('Please configure your MongoDB Atlas MONGODB_URI and required secret keys in backend/.env.')
  process.exit(1)
}

export const config = parsed.data
export const allowedOriginsList = parsed.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
