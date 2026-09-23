import asyncHandler from 'express-async-handler';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import validate from '../../../../utils/validation/validate.js'; 
import writeAuthEvent from '../../../../utils/auth/writeAuthEvent.js';

const VERIFY_SCHEMA = {
  email: { required: true, type: 'email', max: 255 },
  code: { required: true, type: 'string', min: 6, max: 6 },
};

/**
* ---------------------------------------------------
* POST /api/v1/auth/verify
* ---------------------------------------------------
*/
const verify = asyncHandler(async (req, res) => {
  const { email, code } = validate(req?.body, VERIFY_SCHEMA);

  const { rows } = await dbPool.query(
    `SELECT id, email_verified, verification_code, verification_code_expires_at
     FROM users
     WHERE email = $1 AND deleted_at IS NULL 
     LIMIT 1`,
    [email]
  );

  const user = rows[0];

  /**
  if (!user) {
    throw new ApiError(400, 'Invalid verification code');
  }
  */
  
  /** If the account is already verified, say so — but only after confirming the caller knows a code, otherwise this leaks verification status. */
  /**
  if (!user.verification_code) {
    throw new ApiError(400, 'Invalid verification code');
  }
  
  if (user.verification_code !== code) {
    throw new ApiError(400, 'Invalid verification code');
  }
  */

  if (!user) {
    await writeAuthEvent(req, {
      event_type: 'verification_failed',
      attempted_identifier: email,
      metadata: { reason: 'unknown_user' },
    });
    throw new ApiError(400, 'Invalid verification code');
  }
  
  if (user.email_verified) {
    await writeAuthEvent(req, {
      user_id: user.id,
      event_type: 'verification_failed',
      attempted_identifier: email,
      metadata: { reason: 'already_verified' },
    });
    throw new ApiError(409, 'Email is already verified');
  }
  
  if (!user.verification_code || user.verification_code !== code) {
    await writeAuthEvent(req, {
      user_id: user.id,
      event_type: 'verification_failed',
      attempted_identifier: email,
      metadata: { reason: 'invalid_code' },
    });
    throw new ApiError(400, 'Invalid verification code');
  }
  
  if (
    !user.verification_code_expires_at ||
    new Date(user.verification_code_expires_at).getTime() < Date.now()
  ) {
    await writeAuthEvent(req, {
      user_id: user?.id, 
      event_type: 'verification_failed', 
      attempted_identifier: email, 
      metadata: { reason: 'expired' }
    }); 
    throw new ApiError(400, 'Verification code has expired. Request a new one.');
  }

  await dbPool.query(
    `UPDATE users
     SET email_verified = TRUE,
         verification_code = NULL,
         verification_code_expires_at = NULL
     WHERE id = $1`,
    [user.id]
  ); 

  await writeAuthEvent(req, {
    user_id: user?.id, 
    event_type: 'verification_succeeded', 
    attempted_identifier: email, 
  }); 

  res.json({ message: 'Email verified. You can now sign in.' });
});

export default verify;