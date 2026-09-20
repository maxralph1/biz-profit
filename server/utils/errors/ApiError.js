class ApiError extends Error {
  constructor(statusCode, message, errors = null, headers = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.headers = headers;
    this.name = 'ApiError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export default ApiError;