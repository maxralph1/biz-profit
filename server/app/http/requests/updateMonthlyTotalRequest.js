import validate from '../../../utils/validation/validate.js';
import normalizeMonth from '../../../utils/date/normalizeMonth.js';

const CURRENCY_RE = /^[A-Z]{3}$/;

export default function updateMonthlyTotalRequest(reqBody) {
  const data = validate(reqBody, {
    narration: { type: 'string', min: 1 },
    amount: { type: 'integer', notZero: true },
    currency: {
      type: 'string',
      regex: CURRENCY_RE,
      message: 'currency must be a 3-letter uppercase ISO 4217 code',
    },
    month_in_review: { type: 'string' },
    approved: { type: 'boolean' },
  });

  if (data.month_in_review) {
    data.month_in_review = normalizeMonth(data.month_in_review);
  }

  return data;
}