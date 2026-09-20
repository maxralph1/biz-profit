import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import validate from '../../../../utils/validation/validate.js';
import { BCRYPT_ROUNDS } from '../../../../utils/constants.js';
import sendMail from '../../../mails/sendMail.js';
import verificationMail from '../../../mails/templates/verificationMail.js';

const SIGNUP_SCHEMA = {
  first_name: { required: true, type: 'string', max: 255 },
  last_name: { required: true, type: 'string', max: 255 },
  username: { required: true, type: 'string', min: 3, max: 255 },
  email: { required: true, type: 'email', max: 255 },
  password: { required: true, type: 'string', min: 8, max: 255, trim: false },
  country_phone_code: { required: true, type: 'string', max: 10 },
  phone_number: { type: 'string', max: 30 },
};

const UNIQUE_VIOLATIONS = {
  users_username_key: 'Username already taken',
  users_email_key: 'Email already registered',
};

const VERIFICATION_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
* ---------------------------------------------------
* POST /api/v1/auth/sign-up
* ---------------------------------------------------
*/
const signUp = asyncHandler(async (req, res) => {
  const data = validate(req?.body, SIGNUP_SCHEMA);

  const passwordHash = await bcrypt.hash(data?.password, BCRYPT_ROUNDS);
  const verificationCode = generateCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  let row;
  try {
    const result = await dbPool.query(
      `INSERT INTO users (
         first_name, last_name, username, email, password,
         role, country_phone_code, phone_number,
         email_verified, verification_code, verification_code_expires_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11
       )
       RETURNING id, username, email`,
      [
        data?.first_name,
        data?.last_name,
        data?.username,
        data?.email,
        passwordHash,
        'user',
        data?.country_phone_code,
        data?.phone_number ?? null,
        false,
        verificationCode,
        expiresAt,
      ]
    );
    row = result?.rows[0];
  } catch (error) {
    if (error?.code === '23505') {
      throw new ApiError(409, UNIQUE_VIOLATIONS[error.constraint] ?? 'Conflict');
    }
    throw error;
  }

  /** 
  Fire-and-forget would be faster, but then a mail failure leaves the user created and unaware. Better to fail loudly and let them retry.
  A future improvement: transactional outbox pattern.
  */
  await sendMail({
    to: data?.email,
    subject: 'Verify your BizProfit email',
    html: verificationMail({ first_name: data.first_name, code: verificationCode }),
  });

  res.status(201).json({
    message: 'Registration successful. Check your email for a verification code.',
    data: { id: row?.id, username: row?.username, email: row?.email },
  });
});

export default signUp;