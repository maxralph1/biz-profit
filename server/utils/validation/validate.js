import ApiError from '../errors/ApiError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * validate(input, schema)
 *
 * schema: { fieldName: { required, type, min, max, email, regex, message, default, trim } }
 * type:   'string' | 'boolean' | 'integer'
 *
 * Returns a new object containing only the fields declared in `schema`,
 * coerced and trimmed. Throws ApiError(422) with per-field errors on failure.
 */
export default function validate(input, schema) {
  const errors = {};
  const output = {};

  for (const [field, rules] of Object.entries(schema)) {
    const raw = input?.[field];

    /** Default to trimming string inputs unless explicitly disabled. */
    const value =
      rules.trim !== false && typeof raw === 'string' ? raw.trim() : raw;

    /** Missing / empty handling */
    const isMissing = value === undefined || value === null || value === '';
    if (isMissing) {
      if (rules.required) {
        errors[field] = `${field} is required`;
      } else if (rules.default !== undefined) {
        output[field] = rules.default;
      }
      continue;
    }

    /** Type coercion + checks */
    if (rules.type === 'string' && typeof value !== 'string') {
      errors[field] = `${field} must be a string`;
      continue;
    }
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors[field] = `${field} must be a boolean`;
      continue;
    }
    /**
    if (rules.type === 'integer') {
      const n = Number(value);
      if (!Number.isInteger(n)) {
        errors[field] = `${field} must be an integer`;
        continue;
      }
    } 
    */
    if (rules.type === 'integer') {
      const n = Number(value);
      if (!Number.isInteger(n)) {
        errors[field] = `${field} must be an integer`;
        continue;
      }
      if (rules.notZero && n === 0) {
        errors[field] = `${field} must not be zero`;
        continue;
      }
      if (rules.minValue !== undefined && n < rules.minValue) {
        errors[field] = `${field} must be at least ${rules.minValue}`;
        continue;
      }
      if (rules.maxValue !== undefined && n > rules.maxValue) {
        errors[field] = `${field} must be at most ${rules.maxValue}`;
        continue;
      }
      output[field] = n;
      continue;
    }
    if (rules.type === 'uuid') {
      if (typeof value !== 'string' || !UUID_RE.test(value)) {
        errors[field] = `${field} must be a valid UUID`;
        continue;
      }
      output[field] = value.toLowerCase();
      continue;
    }
    if (rules.type === 'email' && !EMAIL_RE.test(value)) {
      errors[field] = `${field} must be a valid email`;
      continue;
    }

    /** String rules */
    if (typeof value === 'string') {
      if (rules.min && value.length < rules.min) {
        errors[field] = `${field} must be at least ${rules.min} characters`;
        continue;
      }
      if (rules.max && value.length > rules.max) {
        errors[field] = `${field} must be at most ${rules.max} characters`;
        continue;
      }
      if (rules.type === 'email' && !EMAIL_RE.test(value)) {
        errors[field] = `${field} must be a valid email`;
        continue;
      }
      if (rules.regex && !rules.regex.test(value)) {
        errors[field] = rules.message || `${field} is invalid`;
        continue;
      }
    }

    output[field] = value;
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(422, 'Validation failed', errors);
  }

  return output;
}