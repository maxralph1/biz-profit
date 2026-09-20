import ApiError from '../errors/ApiError.js';

export default function parseId(raw, label) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return n;
}