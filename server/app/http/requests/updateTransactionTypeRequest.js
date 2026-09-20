import validate from '../../../utils/validation/validate.js';

const TYPE_RE = /^(debit|credit)$/;

export default function updateTransactionTypeRequest(reqBody) {
  return validate(reqBody, {
    name: {
      type: 'string',
      min: 1,
      max: 255,
    },
    description: {
      type: 'string',
      min: 1,
    },
    type: {
      type: 'string',
      regex: TYPE_RE,
      message: 'type must be either debit or credit',
    },
  });
}