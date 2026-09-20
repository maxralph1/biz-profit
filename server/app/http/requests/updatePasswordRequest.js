import validate from '../../../utils/validation/validate.js';

export default function updatePasswordRequest(reqBody) {
  return validate(reqBody, {
    current_password: {
      required: true,
      type: 'string',
      min: 1,
      max: 255,
      trim: false,
    },
    new_password: {
      required: true,
      type: 'string',
      min: 8,
      max: 255,
      trim: false,
    },
  });
}