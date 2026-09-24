import validate from '../../../utils/validation/validate.js';

const ROLE_RE = /^(owner|admin|member)$/;

export default function createBusinessMemberRequest(reqBody) {
  return validate(reqBody, {
    user_id: { required: true, type: 'uuid' },
    role: {
      required: true,
      type: 'string',
      regex: ROLE_RE,
      message: 'role must be one of: owner, admin, member',
    },
  });
}