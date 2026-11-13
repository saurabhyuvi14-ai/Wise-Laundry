import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/wise_laundry_dev'),
  MONGODB_TEST_URI: z.string().default('mongodb://127.0.0.1:27017/wise_laundry_test'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  SESSION_SECRET: z.string().default('wise-laundry-session-secret-salt-key-999'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(20),
  DEFAULT_SLOT_CAPACITY: z.coerce.number().default(10),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format())
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid environment configuration in production')
  }
}

export const config = parsed.success ? parsed.data : envSchema.parse({})
export const allowedOriginsList = config.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
