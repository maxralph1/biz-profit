import validate from '../../../utils/validation/validate.js';
import normalizeMonth from '../../../utils/date/normalizeMonth.js';

const CURRENCY_RE = /^[A-Z]{3}$/;

export default function createMonthlyTotalRequest(reqBody) {
  const data = validate(reqBody, {
    narration: { required: true, type: 'string', min: 1 },
    amount: { required: true, type: 'integer', notZero: true },
    currency: {
      required: true,
      type: 'string',
      regex: CURRENCY_RE,
      message: 'currency must be a 3-letter uppercase ISO 4217 code',
    },
    month_in_review: { 
      required: true, 
      type: 'string' 
    },
  });

  /** Normalize the month after validate() has done presence/type checking. */
  data.month_in_review = normalizeMonth(data.month_in_review);

  return data;
}