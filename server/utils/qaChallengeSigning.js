import 'dotenv/config';
import jwt from 'jsonwebtoken';

const QA_CHALLENGE_TTL_SECONDS = 5 * 60;

if (!process.env.QA_CHALLENGE_SECRET) {
  throw new Error('QA_CHALLENGE_SECRET is not set');
}

export function signQaChallenge(user) {
  return jwt.sign(
    {
      purpose: 'qa-challenge',
      sub: user.id,
      username: user.username,
    },
    process.env.QA_CHALLENGE_SECRET,
    { expiresIn: QA_CHALLENGE_TTL_SECONDS }
  );
}

export function verifyQaChallenge(token) {
  const payload = jwt.verify(token, process.env.QA_CHALLENGE_SECRET);

  if (payload?.purpose !== 'qa-challenge') {
    throw new Error('Invalid challenge token purpose');
  }
  if (!payload?.sub || !payload?.username) {
    throw new Error('Invalid challenge token payload');
  }

  return { user_id: payload.sub, username: payload.username };
}