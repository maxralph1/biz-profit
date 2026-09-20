import 'dotenv/config';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import validate from '../../../../utils/validation/validate.js';
import { BCRYPT_ROUNDS } from '../../../../utils/constants.js';
import sendMail from '../../../mails/sendMail.js';
import passwordResetMail from '../../../mails/templates/passwordResetMail.js';

const RESET_TTL_MS = 10 * 60 * 1000;
const GENERIC_RESPONSE = {
  message: 'If an account with that email exists, a reset link has been sent.',
};

/**
* ---------------------------------------------------
* POST /api/v1/auth/mail-password-reset-link
* ---------------------------------------------------
*/
const mailPasswordResetLink = asyncHandler(async (req, res) => {
  const { email } = validate(req.body, {
    email: { required: true, type: 'email', max: 255 },
  });

  const { rows } = await dbPool.query(
    'SELECT id, first_name, email FROM users WHERE email = $1 LIMIT 1',
    [email]
  );

  const user = rows[0];
  /** No enumeration: same response whether or not the account exists, and same response even if mail sending later fails. */
  if (!user) {
    return res.status(200).json(GENERIC_RESPONSE);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await dbPool.query(
    `UPDATE users
     SET password_reset_token = $1,
         password_reset_token_expires_at = $2
     WHERE id = $3`,
    [token, expiresAt, user.id]
  );

  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontend}/reset-password?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your BizProfit password',
    html: passwordResetMail({ first_name: user.first_name, reset_url: resetUrl }),
  });

  res.status(200).json(GENERIC_RESPONSE);
});

/**
* ---------------------------------------------------
* PUT /api/v1/auth/password-reset
* ---------------------------------------------------
*/
const passwordReset = asyncHandler(async (req, res) => {
  const { token, password } = validate(req.body, {
    token: { required: true, type: 'string', max: 128 },
    password: { required: true, type: 'string', min: 8, max: 255, trim: false },
  });

  const { rows } = await dbPool.query(
    `SELECT id
     FROM users
     WHERE password_reset_token = $1
       AND password_reset_token_expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [token]
  );

  const user = rows[0];
  /** Same error for "no such token" and "expired token" — no probing. */
  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await dbPool.query(
    `UPDATE users
     SET password = $1,
         password_reset_token = NULL,
         password_reset_token_expires_at = NULL
     WHERE id = $2`,
    [passwordHash, user.id]
  );

  res.json({ message: 'Password reset successful. You can now sign in.' });
});

export { mailPasswordResetLink, passwordReset };