export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
export const isPhone = (v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, '').slice(-10))
export const isPincode = (v) => /^\d{6}$/.test(v.trim())
export const required = (v) => String(v ?? '').trim().length > 0

/** Runs a { field: [rule, message][] } map and returns { field: message }. */
export function validate(values, schema) {
  const errors = {}
  for (const [field, rules] of Object.entries(schema)) {
    for (const [rule, message] of rules) {
      if (!rule(values[field] ?? '', values)) {
        errors[field] = message
        break
      }
    }
  }
  return errors
}

/** Only allow internal paths as post-login redirects. */
export function safeRedirect(path, fallback = '/customer') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}
