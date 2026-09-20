import accessTokenSigning from '../../utils/accessTokenSigning.js';

export function bearerFor(user) {
  return `Bearer ${accessTokenSigning(user)}`;
}