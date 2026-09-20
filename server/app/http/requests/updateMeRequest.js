import validate from '../../../utils/validation/validate.js';

export default function updateMeRequest(reqBody) {
  return validate(reqBody, {
    first_name: { type: 'string', max: 255 },
    last_name: { type: 'string', max: 255 },
    username: { type: 'string', min: 3, max: 255 },
    email: { type: 'email', max: 255 },
    country_phone_code: { type: 'string', max: 10 },
    phone_number: { type: 'string', max: 30 },
    secret_question_login: { type: 'boolean' },
    secret_question: { type: 'string', max: 255 },
    secret_question_answer: { 
      type: 'string', 
      max: 255, 
      trim: false 
    },
  });
}