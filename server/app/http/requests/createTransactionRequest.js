/**
import validate from '../../../utils/validation/validate.js';
import ApiError from '../../../utils/errors/ApiError.js';

const CURRENCY_RE = /^[A-Z]{3}$/;

export default function createTransactionRequest(reqBody) {
  const data = validate(reqBody, {
    transaction_type_id: { required: true, type: 'integer', minValue: 1 },
    narration: { required: true, type: 'string', min: 1 },
    amount: { required: true, type: 'integer', minValue: 1 },
    currency: {
      required: true,
      type: 'string',
      regex: CURRENCY_RE,
      message: 'currency must be a 3-letter uppercase ISO 4217 code',
    },
    transaction_date: { type: 'string' },
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

export default function createTransactionRequest(reqBody) {
  const data = validate(reqBody, {
    transaction_type_id: { required: true, type: 'uuid' },
    narration: { required: true, 
                 type: 'string', 
                 min: 1 
               },
    amount: { required: true, type: 'integer', notZero: true },
    currency: {
      required: true,
      type: 'string',
      regex: CURRENCY_RE,
      message: 'currency must be a 3-letter uppercase ISO 4217 code',
    },
    transaction_date: { type: 'string' },
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