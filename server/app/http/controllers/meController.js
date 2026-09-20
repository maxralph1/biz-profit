import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import { BCRYPT_ROUNDS } from '../../../utils/constants.js';
import updateMeRequest from '../requests/updateMeRequest.js';
import { UNIQUE_VIOLATIONS } from '../requests/createUserRequest.js';
import USER_PUBLIC_COLUMNS from '../resources/userResource.js';
import sendMail from '../../mails/sendMail.js';
import verificationMail from '../../mails/templates/verificationMail.js';

import accessTokenSigning from '../../../utils/accessTokenSigning.js';
import refreshTokenSigning from '../../../utils/refreshTokenSigning.js';
import { REFRESH_COOKIE_OPTIONS } from '../../../utils/auth/refreshCookie.js';
import updatePasswordRequest from '../requests/updatePasswordRequest.js';

const VERIFICATION_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
* ---------------------------------------------------
* GET /api/v1/me
* ---------------------------------------------------
*/
const getMe = asyncHandler(async (req, res) => {
  const { rows } = await dbPool.query(
    `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (rows.length === 0) {
    /** Signed token, but no such user. Treat as auth failure. */
    throw new ApiError(401, 'Account no longer exists');
  }

  res.json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/me
* ---------------------------------------------------
*/
const updateMe = asyncHandler(async (req, res) => {
  const data = updateMeRequest(req.body);

  /** Cross-field rule: enabling QA requires the question and answer to be present in the same payload. Changing an existing answer (already opted in) is fine without this flag — the update just overwrites. */
  if (data.secret_question_login === true) {
    const errors = {};
    if (!data.secret_question) {
      errors.secret_question = 'secret_question is required when enabling QA login';
    }
    if (!data.secret_question_answer) {
      errors.secret_question_answer = 'secret_question_answer is required when enabling QA login';
    }
    if (Object.keys(errors).length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }
  }

  /** Load current row: needed to detect an actual email change (vs. an unchanged email sent as part of an unrelated update). */
  const { rows: currentRows } = await dbPool.query(
    'SELECT id, email FROM users WHERE id = $1',
    [req.user.id]
  );
  if (currentRows.length === 0) {
    throw new ApiError(401, 'Account no longer exists');
  }
  const current = currentRows[0];

  /** Hash QA answer if provided. */
  if (data.secret_question_answer) {
    data.secret_question_answer = await bcrypt.hash(
      data.secret_question_answer,
      BCRYPT_ROUNDS
    );
  }

  /** Email change → force re-verification on the new address. */
  const emailChanged = data.email && data.email !== current.email;
  let verificationCode = null;
  if (emailChanged) {
    verificationCode = generateCode();
    data.email_verified = false;
    data.verification_code = verificationCode;
    data.verification_code_expires_at = new Date(Date.now() + VERIFICATION_TTL_MS);
  }

  const fields = Object.keys(data);
  if (fields.length === 0) {
    throw new ApiError(400, 'No updatable fields provided');
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map((f) => data[f]);
  values.push(req.user.id);

  let result;
  try {
    result = await dbPool.query(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      values
    );
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError(409, UNIQUE_VIOLATIONS[error.constraint] ?? 'Conflict');
    }
    throw error;
  }

  /** Fire-and-forget-ish: if mail fails, the DB change is already committed. The user can request a new code via the resend endpoint (not built yet). */
  if (emailChanged && verificationCode) {
    await sendMail({
      to: data.email,
      subject: 'Verify your new BizProfit email',
      html: verificationMail({
        first_name: result.rows[0].first_name,
        code: verificationCode,
      }),
    });
  }

  res.json({ data: result.rows[0] });
});

/**
* ---------------------------------------------------
* PUT /api/v1/me/password
* ---------------------------------------------------
*/
const updatePassword = asyncHandler(async (req, res) => {
  const data = updatePasswordRequest(req.body);
  const userId = req.user.id;

  const { rows } = await dbPool.query(
    'SELECT id, password FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) throw new ApiError(401, 'Account no longer exists');

  const currentMatch = await bcrypt.compare(data.current_password, user.password);
  if (!currentMatch) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  if (data.current_password === data.new_password) {
    throw new ApiError(422, 'Validation failed', {
      new_password: 'new_password must be different from current_password',
    });
  }

  const newHash = await bcrypt.hash(data.new_password, BCRYPT_ROUNDS);

  /** Setting password_changed_at invalidates every refresh token issued before this moment. The current session gets a fresh token pair in the response, so it isn't logged out. */
  const { rows: updatedRows } = await dbPool.query(
    `UPDATE users
     SET password = $1,
         password_changed_at = CURRENT_TIMESTAMP,
         password_reset_token = NULL,
         password_reset_token_expires_at = NULL
     WHERE id = $2
     RETURNING id, username, first_name, last_name, email, role, country_phone_code, phone_number`,
    [newHash, userId]
  );

  const updated = updatedRows[0];
  const accessToken = accessTokenSigning(updated);
  const refreshToken = refreshTokenSigning(updated);

  res.cookie('jwt', refreshToken, REFRESH_COOKIE_OPTIONS)
    .json({
      message: 'Password changed. Other sessions will expire within the hour.',
      access_token: accessToken,
    });
});

export { getMe, updateMe, updatePassword };