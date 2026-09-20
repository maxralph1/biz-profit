import 'dotenv/config'; 
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import accessTokenSigning from '../../../../utils/accessTokenSigning.js';
import refreshTokenSigning from '../../../../utils/refreshTokenSigning.js';

const REFRESH_COOKIE_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.ENV === 'production',
  sameSite: 'lax',
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
};

const signIn = asyncHandler(async (req, res) => {
  const { email_username, password } = req.body ?? {};

  if (!email_username || !password) {
    throw new ApiError(400, 'Email/username and password are required');
  }

  const { rows } = await dbPool.query(
    `SELECT id, username, password, role, secret_question_login, email_verified
     FROM users
     WHERE username = $1 OR email = $1
     LIMIT 1`,
    [email_username]
  );

  /**
  console.log('[signIn] query returned rows:', rows.length);
  if (rows[0]) {
    console.log('[signIn] user.password length:', rows[0].password?.length);
    console.log('[signIn] user.email_verified:', rows[0].email_verified);
    console.log('[signIn] compare result:',
      await bcrypt.compare(password, rows[0].password));
  }
  */

  // Same error for "no such user" and "bad password" — don't leak which.
  const user = rows[0];
  
  const passwordMatch = user && (await bcrypt.compare(password, user.password));
  if (!passwordMatch) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!user.email_verified) {
    throw new ApiError(403, 'Email not verified. Check your inbox for the verification code.');
  }

  if (user.secret_question_login) {
    return res.status(202).json({
      data: {
        user_id: user.id,
        user_username: user.username,
      },
    });
  }

  const accessToken = accessTokenSigning(user);
  const refreshToken = refreshTokenSigning(user);

  res
    .cookie('jwt', refreshToken, REFRESH_COOKIE_OPTIONS)
    .json({ access_token: accessToken });
});

const signInWithSecretQA = asyncHandler(async (req, res) => {
  const { user_id, user_username, secret_question_answer } = req.body ?? {};

  if (!user_id || !user_username || !secret_question_answer) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { rows } = await dbPool.query(
    `SELECT id, username, role, secret_question_answer, email_verified
     FROM users
     WHERE id = $1
       AND username = $2
       AND secret_question_login = TRUE
     LIMIT 1`,
    [user_id, user_username]
  );

  const user = rows[0];

  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }
  
  if (!user.email_verified) {
    throw new ApiError(403, 'Email not verified');
  }
  
  const answerMatch = await bcrypt.compare(
    secret_question_answer,
    user.secret_question_answer
  );
  
  if (!answerMatch) {
    throw new ApiError(401, 'Unauthorized');
  }

  const accessToken = accessTokenSigning(user);
  const refreshToken = refreshTokenSigning(user);

  res
    .cookie('jwt', refreshToken, REFRESH_COOKIE_OPTIONS)
    .json({ access_token: accessToken });
});

export { signIn, signInWithSecretQA };