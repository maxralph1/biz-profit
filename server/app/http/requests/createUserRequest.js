import validate from '../../../utils/validation/validate.js';

export default function createUserRequest(reqBody) {
  const CREATE_USER_SCHEMA = {
    first_name: { 
      required: true, 
      type: 'string', 
      max: 255 
    }, 
    last_name: { 
      required: true, 
      type: 'string', 
      max: 255 
    }, 
    username: { 
      required: true, 
      type: 'string', 
      min: 3, 
      max: 255 
    }, 
    email: { 
      required: true, 
      type: 'email', 
      max: 255 
    }, 
    password: { 
      required: true, 
      type: 'string', 
      min:8, 
      max: 255, 
      trim: false 
    }, 
    country_phone_code: { type: 'string', max: 10 }, 
    phone_number: { type: 'string', max: 30 }, 
  }; 

  return validate(reqBody, CREATE_USER_SCHEMA); 
} 

export const UNIQUE_VIOLATIONS = {
  users_username_key: 'Username already taken', 
  users_email_key: 'Email already registered'
}; 