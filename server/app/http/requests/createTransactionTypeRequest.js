import validate from '../../../utils/validation/validate.js';

const TYPE_RE = /^(debit|credit)$/;

export default function createTransactionTypeRequest(reqBody) {
  return validate(reqBody, {
    name: {
      required: true,
      type: 'string',
      min: 1,
      max: 255,
    },
    description: {
      required: true,
      type: 'string',
      min: 1,
    },
    type: {
      type: 'string',
      regex: TYPE_RE,
      message: 'type must be either debit or credit',
      default: 'debit',
    },
  });
}