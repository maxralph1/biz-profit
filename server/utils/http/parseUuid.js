import ApiError from '../errors/ApiError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function parseUuid(raw, label) {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return raw.toLowerCase();
}