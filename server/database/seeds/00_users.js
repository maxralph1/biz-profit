import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../../utils/constants.js';

export default async function seedUsers(dbClient, ctx) {
  // const ROUNDS = process.env.ENV === 'test' ? 4 : 10;
  // const passwordHash = await bcrypt.hash('Password123!', ROUNDS);
  const passwordHash = await bcrypt.hash('Password123!', BCRYPT_ROUNDS);
  // const qaAnswerHash = await bcrypt.hash('Turing', ROUNDS);
  const qaAnswerHash = await bcrypt.hash('Turing', BCRYPT_ROUNDS);

  const { rows } = await dbClient.query(`
    INSERT INTO users (
      first_name, last_name, username, email, password, secret_question, secret_question_answer, secret_question_login, role, country_phone_code, phone_number, email_verified
    ) VALUES
      ('Ada', 'Lovelace', 'ada',      'ada@example.com', $1, 'First pet?', $2, TRUE, 'user', '+44', '7700900001', TRUE),
      ('Grace', 'Hopper', 'grace', 'grace@example.com', $1, 'First pet?', $2, FALSE, 'user', '+1', '2025550002', TRUE),
      ('Alan', 'Turing', 'alan', 'alan@example.com', $1, 'First pet?', $2, FALSE, 'user',  '+44', '7700900003', TRUE),
      ('Site', 'Admin', 'siteadmin', 'siteadmin@example.com', $1, 'First pet?', $2, FALSE, 'admin', '+1', '2025550004', TRUE),
      ('Stella', 'Stranger', 'stranger', 'stranger@example.com', $1, 'First pet?', $2, FALSE, 'user',  '+1', '2025550005', TRUE)
    RETURNING id, username
  `, [passwordHash, qaAnswerHash]);

  ctx.userIds = Object.fromEntries(rows.map(r => [r.username, r.id]));
}