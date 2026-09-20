import validate from '../../../utils/validation/validate.js';

const ROLE_RE = /^(owner|admin|member)$/;

export default function updateBusinessMemberRequest(reqBody) {
  return validate(reqBody, {
    role: {
      required: true,
      type: 'string',
      regex: ROLE_RE,
      message: 'role must be one of: owner, admin, member',
    },
  });
}