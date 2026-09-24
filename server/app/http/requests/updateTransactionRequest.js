/**
import validate from '../../../utils/validation/validate.js';
import ApiError from '../../../utils/errors/ApiError.js';

const CURRENCY_RE = /^[A-Z]{3}$/;

export default function updateTransactionRequest(reqBody) {
  const data = validate(reqBody, {
    narration: { type: 'string', min: 1 },
    amount: { type: 'integer', minValue: 1 },
    currency: {
      type: 'string',
      regex: CURRENCY_RE,
      message: 'currency must be a 3-letter uppercase ISO 4217 code',
    },
    transaction_type_id: { type: 'integer', minValue: 1 },
    transaction_date: { type: 'string' },
    approved: { type: 'boolean' },
  });

  if (data.transaction_date) {
    const d = new Date(data.transaction_date);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(422, 'Validation failed', {
        transaction_date: 'transaction_date must be a valid date',
      });
    }
    data.transaction_date = d.toISOString();
  }

  return data;
}
*/


import validate from '../../../utils/validation/validate.js';
import ApiError from '../../../utils/errors/ApiError.js';

const CURRENCY_RE = /^[A-Z]{3}$/;

export default function updateTransactionRequest(reqBody) {
  const data = validate(reqBody, {
    narration: { type: 'string', min: 1 },
    amount: { type: 'integer', notZero: true },
    currency: {
      type: 'string',
      regex: CURRENCY_RE,
      message: 'currency must be a 3-letter uppercase ISO 4217 code',
    },
    transaction_type_id: { type: 'uuid' },
    transaction_date: { type: 'string' },
    approved: { type: 'boolean' },
  });

  if (data.transaction_date) {
    const d = new Date(data.transaction_date);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(422, 'Validation failed', {
        transaction_date: 'transaction_date must be a valid date',
      });
    }
    data.transaction_date = d.toISOString();
  }

  return data;
}