import dbClient from '../../config/db/dbClient.js';

export async function fetchVerificationCode(email) {
  const { rows } = await dbClient.query(
    'SELECT verification_code FROM users WHERE email = $1',
    [email]
  );
  return rows[0]?.verification_code ?? null;
}

export async function fetchEmailVerified(email) {
  const { rows } = await dbClient.query(
    'SELECT email_verified FROM users WHERE email = $1',
    [email]
  );
  return rows[0]?.email_verified ?? null;
}

export async function expireVerificationCode(email) {
  await dbClient.query(
    `UPDATE users
     SET verification_code_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'
     WHERE email = $1`,
    [email]
  );
}