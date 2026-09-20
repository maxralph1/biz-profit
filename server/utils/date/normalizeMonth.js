import ApiError from '../errors/ApiError.js';

/**
 * Accepts "YYYY-MM" or any ISO date string, returns "YYYY-MM-01".
 * Throws 422 if the input doesn't parse as a month.
 */
export default function normalizeMonth(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new ApiError(422, 'Validation failed', {
      month_in_review: 'month_in_review must be a non-empty string',
    });
  }

  const s = input.trim();

  /** "YYYY-MM" — append day 01 and parse. */
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(s);
  if (monthOnly) {
    const [, y, m] = monthOnly;
    const monthNum = Number(m);
    if (monthNum < 1 || monthNum > 12) {
      throw new ApiError(422, 'Validation failed', {
        month_in_review: 'month_in_review must be a valid YYYY-MM',
      });
    }
    return `${y}-${m}-01`;
  }

  /** Any other ISO date — parse and normalize. */
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(422, 'Validation failed', {
      month_in_review: 'month_in_review must be a valid date or YYYY-MM',
    });
  }

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}