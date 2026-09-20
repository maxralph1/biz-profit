import ApiError from '../errors/ApiError.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * In-memory store. Lost on process restart and not shared across instances.
 * For multi-instance deploys, swap for a Redis-backed store with the same
 * interface: `INCR` + `EXPIRE` per key.
 */
const buckets = new Map();

/**
 * Registers an attempt for this user. Throws 429 (with Retry-After) if the
 * user has exceeded the window. Call again after a successful auth to clear.
 */
export function checkQaRateLimit(userId) {
  const now = Date.now();
  const key = String(userId);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(
      429,
      'Too many attempts. Please try again later.',
      null,
      { 'Retry-After': String(retryAfterSec) }
    );
  }

  bucket.count += 1;
}

export function clearQaRateLimit(userId) {
  buckets.delete(String(userId));
}

/** Test-only helper. Clears all buckets so test order doesn't leak state. */
export function _resetAllQaRateLimits() {
  buckets.clear();
}