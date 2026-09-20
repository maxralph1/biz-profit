import 'dotenv/config';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import accessTokenSigning from '../../../../utils/accessTokenSigning.js';
import refreshTokenSigning from '../../../../utils/refreshTokenSigning.js';
import { signQaChallenge, verifyQaChallenge } from '../../../../utils/qaChallengeSigning.js';
import { checkQaRateLimit, clearQaRateLimit } from '../../../../utils/rateLimit/qaAttempts.js';
import { REFRESH_COOKIE_OPTIONS } from '../../../../utils/auth/refreshCookie.js';

/**
const REFRESH_COOKIE_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.ENV === 'production',
  sameSite: 'lax',
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
};
*/

/**
* ---------------------------------------------------
* POST /api/v1/auth/sign-in
* ---------------------------------------------------
*/
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

  const user = rows[0];
  const passwordMatch = user && (await bcrypt.compare(password, user.password));
  if (!passwordMatch) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!user.email_verified) {
    throw new ApiError(403, 'Email not verified. Check your inbox for the verification code.');
  }

  if (user.secret_question_login) {
    const challengeToken = signQaChallenge(user);
    return res.status(202).json({
      data: { challenge_token: challengeToken },
    });
  }

  const accessToken = accessTokenSigning(user);
  const refreshToken = refreshTokenSigning(user);

  res
    .cookie('jwt', refreshToken, REFRESH_COOKIE_OPTIONS)
    .json({ access_token: accessToken });
});

/**
* ---------------------------------------------------
* POST /api/v1/auth/sign-in-with-qa
* ---------------------------------------------------
*/
const signInWithSecretQA = asyncHandler(async (req, res) => {
  const { challenge_token, secret_question_answer } = req.body ?? {};

  if (!challenge_token || !secret_question_answer) {
    throw new ApiError(401, 'Unauthorized');
  }

  let challenge;
  try {
    challenge = verifyQaChallenge(challenge_token);
  } catch {
    throw new ApiError(401, 'Unauthorized');
  }

  /** Rate-limit here — we know the user_id from the verified token, and we want the limit to apply before the (cheap) DB lookup and (costlier) bcrypt compare. */
  checkQaRateLimit(challenge.user_id);

  const { rows } = await dbPool.query(
    `SELECT id, username, role, secret_question_answer, email_verified
     FROM users
     WHERE id = $1
       AND username = $2
       AND secret_question_login = TRUE
     LIMIT 1`,
    [challenge.user_id, challenge.username]
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

  /** Success — clear the failed-attempt counter for this user. */
  clearQaRateLimit(challenge.user_id);

  const accessToken = accessTokenSigning(user);
  const refreshToken = refreshTokenSigning(user);

  res.cookie('jwt', refreshToken, REFRESH_COOKIE_OPTIONS)
    .json({ access_token: accessToken });
});

export { signIn, signInWithSecretQA };