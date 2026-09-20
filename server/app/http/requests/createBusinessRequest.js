import validate from '../../../utils/validation/validate.js';

export default function createBusinessRequest(reqBody) {
  const CREATE_BUSINESS_SCHEMA = {
    name: { required: true, 
            type: 'string', 
            max: 255 
          },
    description: { required: true, type: 'string' },
  };

  return validate(reqBody, CREATE_BUSINESS_SCHEMA);
}