import validate from '../../../utils/validation/validate.js';

const ROLE_RE = /^(user|admin)$/;

export default function updateUserRequest(reqBody) {
  
  /** Maps FK constraint names on `users` to client-facing 409 messages. 
  Every FK to users is ON DELETE RESTRICT, so a delete only succeeds for users with no activity yet. 
  */

  const UPDATE_USER_SCHEMA = {
    first_name: { type: 'string', max: 255 },
    last_name: { type: 'string', max: 255 },
    username: { type: 'string', min: 3, max: 255 },
    email: { type: 'email', max: 255 }, 
    role: {
      type: 'string',
      regex: ROLE_RE,
      message: 'role must be either user or admin',
    },
    secret_question_login: { type: 'boolean' },
    secret_question: { type: 'string', max: 255 },
    secret_question_answer: { 
      type: 'string', 
      max: 255, 
      trim: false 
    },
    country_phone_code: { type: 'string', max: 10 },
    phone_number: { type: 'string', max: 30 },
  };

  return validate(reqBody, UPDATE_USER_SCHEMA);
}

export const USER_FK_VIOLATIONS = {
  fk_business_user: 'Cannot delete user: they own businesses.',
  fk_business_user_user: 'Cannot delete user: they are members of businesses.',
  fk_transaction_type_user: 'Cannot delete user: they have transaction types.',
  fk_transaction_creator: 'Cannot delete user: they have created transactions.',
  fk_transaction_approver: 'Cannot delete user: they have approved transactions.',
  fk_monthly_total_creator: 'Cannot delete user: they have created monthly totals.',
  fk_monthly_total_approver: 'Cannot delete user: they have approved monthly totals.',
};



/**
import validate from '../../../utils/validation/validate.js';

const ROLE_RE = /^(user|admin)$/;

export default function updateUserRequest(reqBody) {
  return validate(reqBody, {
    first_name: { type: 'string', max: 255 },
    last_name: { type: 'string', max: 255 },
    username: { type: 'string', min: 3, max: 255 },
    email: { type: 'email', max: 255 },
    role: {
      type: 'string',
      regex: ROLE_RE,
      message: 'role must be either user or admin',
    },
    secret_question_login: { type: 'boolean' },
    secret_question: { type: 'string', max: 255 },
    secret_question_answer: { type: 'string', max: 255, trim: false },
    country_phone_code: { type: 'string', max: 10 },
    phone_number: { type: 'string', max: 30 },
  });
}
*/