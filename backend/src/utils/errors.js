export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }

  static badRequest(message, fields = {}) {
    return new ApiError(400, 'VALIDATION_ERROR', message, fields)
  }

  static unauthenticated(message = 'Please sign in to continue.') {
    return new ApiError(401, 'UNAUTHENTICATED', message)
  }

  static forbidden(message = 'You do not have permission to access this resource.') {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message = 'We could not find that resource.') {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(message = 'Resource already exists or conflict detected.', fields = {}) {
    return new ApiError(409, 'CONFLICT', message, fields)
  }

  static rateLimited(message = 'Too many requests. Please wait a moment and try again.') {
    return new ApiError(429, 'RATE_LIMITED', message)
  }

  static internal(message = 'An unexpected internal server error occurred.') {
    return new ApiError(500, 'SERVER_ERROR', message)
  }
}
