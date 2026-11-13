import crypto from 'node:crypto'
import { config } from '../config/env.js'

// Derive a 32-byte key buffer using SHA-256 on the configured secret
const KEY = crypto.createHash('sha256').update(config.ENCRYPTION_KEY).digest()
const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'v1'

/**
 * Encrypts a plaintext string using AES-256-GCM with fresh 12-byte IV.
 * Output format: v1:ivHex:authTagHex:ciphertextHex
 */
export function encrypt(text) {
  if (text == null || text === '') return text
  const str = String(text)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  let encrypted = cipher.update(str, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${PREFIX}:${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypts a v1:ivHex:authTagHex:ciphertextHex string.
 * Gracefully falls back to raw text if not encrypted (supports legacy/unencrypted migration).
 */
export function decrypt(text) {
  if (text == null || text === '') return text
  const str = String(text)
  if (!str.startsWith(`${PREFIX}:`)) {
    return str
  }

  try {
    const parts = str.split(':')
    if (parts.length !== 4) return str
    const [, ivHex, authTagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    // If decryption fails (e.g. tampering or bad key), return masked or throw
    return '[CORRUPTED_OR_TAMPERED]'
  }
}

/**
 * Generates a cryptographically secure random hex token.
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Deterministically hashes a token using SHA-256 with an internal salt.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(`${token}:${config.SESSION_SECRET}`).digest('hex')
}
