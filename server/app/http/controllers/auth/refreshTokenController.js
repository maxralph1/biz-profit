import 'dotenv/config';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import accessTokenSigning from '../../../../utils/accessTokenSigning.js'; 
import writeAuthEvent from '../../../../utils/auth/writeAuthEvent.js';

/**
* ---------------------------------------------------
* POST /api/v1/auth/refresh-token
* ---------------------------------------------------
*/
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.jwt;
  if (!token) {
    await writeAuthEvent(req, {
      event_type: 'refresh_failed',  
      metadata: { reason: 'no_cookie' }
    });
    throw new ApiError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    await writeAuthEvent(req, {
      event_type: 'refresh_failed',  
      metadata: { reason: 'invalid_token' }
    });
    throw new ApiError(403, 'Invalid or expired refresh token');
  }

  /**
  const { id, username } = payload?.user ?? {};
  if (!id || !username) {
    throw new ApiError(401, 'Invalid refresh token payload');
  }
  */
  const { id } = payload?.user ?? {};
  if (!id) {
    throw new ApiError(401, 'Invalid refresh token payload');
  }

  /** Refresh is the one place we re-fetch from the DB. If the user's role changed or their username was edited, the new access token should reflect that — the refresh token is a snapshot from up to 15 days ago. */
  /**
  const { rows } = await dbPool.query(
    `SELECT id, first_name, last_name, username, email, role, country_phone_code, phone_number
     FROM users
     WHERE id = $1 AND username = $2
     LIMIT 1`,
    [id, username]
  );
  */
  const { rows } = await dbPool.query(
    `SELECT id, first_name, last_name, username, email, role, country_phone_code, phone_number, password_changed_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL 
     LIMIT 1`,
    [id]
  );

  const user = rows[0];
  if (!user) {
    await writeAuthEvent(req, {
      event_type: 'refresh_failed',  
      metadata: { reason: 'user_gone' }
    });
    throw new ApiError(401, 'Unauthorized');
  }

  /** If the password has been changed since this token was issued, the token is dead. JWT `iat` is in seconds, so we floor the DB timestamp for comparison. This gives a sub-second grace window around the password change — negligible, and it lets the just-issued token from the change response work. */
  if (user.password_changed_at) {
    const changedAtSec = Math.floor(
      new Date(user.password_changed_at).getTime() / 1000
    );
    console.log('DBG iat:', payload.iat, 'changedAtSec:', changedAtSec);
    
    if (payload.iat < changedAtSec) {
      await writeAuthEvent(req, {
        user_id: user?.id, 
        event_type: 'refresh_failed', 
        metadata: { reason: 'password_changed' }
      });
      throw new ApiError(401, 'Session invalidated by password change');
    }
  }
  
  const accessToken = accessTokenSigning(user);

  await writeAuthEvent(req, {
    user_id: user?.id, 
    event_type: 'refresh_succeeded'
  });
  
  res.json({ access_token: accessToken });
});

export default refreshToken;