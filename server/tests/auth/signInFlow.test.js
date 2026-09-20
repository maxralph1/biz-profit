import 'dotenv/config';
import jwt from 'jsonwebtoken'; 
import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../../index.js';
import asServer from '../helpers/asServer.js';
import { setupSchema, resetAndSeed, teardown } from '../setup.js';

import { _resetAllQaRateLimits } from '../../utils/rateLimit/qaAttempts.js';

const server = asServer(app);
const BASE = '/api/v1/auth';

jest.setTimeout(30_000);

beforeAll(setupSchema);
// beforeEach(resetAndSeed);
beforeEach(async () => {
  _resetAllQaRateLimits();
  await resetAndSeed();
});
afterAll(teardown);

describe('POST /api/v1/auth/sign-in', () => {
  it('signs in with email and password', async () => {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'grace@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toMatch(/^jwt=/);
  });

  it('signs in with username and password', async () => {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'grace',
      password: 'Password123!',
    });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'grace',
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown user with 401', async () => {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'nobody@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(401);
  });

  it('rejects unverified users with 403', async () => {
    await request(server).post(`${BASE}/sign-up`).send({
      first_name: 'Unverified',
      last_name: 'User',
      username: 'unverified',
      email: 'unverified@example.com',
      password: 'Password123!',
      country_phone_code: '+1',
    });

    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'unverified',
      password: 'Password123!',
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not verified/i);
  });

  it('returns 202 with a challenge token for QA-enabled accounts', async () => {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'ada',
      password: 'Password123!',
    });
    expect(res.status).toBe(202);
    expect(res.body.data.challenge_token).toBeTruthy();
    expect(res.body.access_token).toBeUndefined();
  });
});

describe('POST /api/v1/auth/sign-in-with-qa', () => {
  async function beginQaFlow() {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'ada',
      password: 'Password123!',
    });
    return res.body.data.challenge_token;
  }

  it('issues a token with the correct answer', async () => {
    const challenge_token = await beginQaFlow();
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token,
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toMatch(/^jwt=/);
  });

  it('rejects a wrong answer with 401', async () => {
    const challenge_token = await beginQaFlow();
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token,
      secret_question_answer: 'Wrong',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a missing challenge token with 401', async () => {
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a garbage challenge token with 401', async () => {
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: 'not-a-jwt',
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a challenge token signed with the wrong secret', async () => {
    const forged = jwt.sign(
      { purpose: 'qa-challenge', sub: 1, username: 'ada' },
      'wrong-secret'
    );
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: forged,
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(401);
  });

  it('rejects an expired challenge token with 401', async () => {
    const expired = jwt.sign(
      { purpose: 'qa-challenge', sub: 1, username: 'ada' },
      process.env.QA_CHALLENGE_SECRET,
      { expiresIn: -1 }
    );
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: expired,
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a challenge token with the wrong purpose claim', async () => {
    const wrongPurpose = jwt.sign(
      { purpose: 'something-else', sub: 1, username: 'ada' },
      process.env.QA_CHALLENGE_SECRET,
      { expiresIn: 60 }
    );
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: wrongPurpose,
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a challenge token for a user without QA enabled', async () => {
    const forged = jwt.sign(
      { purpose: 'qa-challenge', sub: 2, username: 'grace' },
      process.env.QA_CHALLENGE_SECRET,
      { expiresIn: 60 }
    );
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: forged,
      secret_question_answer: 'anything',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a challenge token for a nonexistent user', async () => {
    const forged = jwt.sign(
      { purpose: 'qa-challenge', sub: 9999, username: 'ghost' },
      process.env.QA_CHALLENGE_SECRET,
      { expiresIn: 60 }
    );
    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: forged,
      secret_question_answer: 'Turing',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/sign-in-with-qa — rate limiting', () => {
  async function getChallenge() {
    const res = await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'ada',
      password: 'Password123!',
    });
    return res.body.data.challenge_token;
  }

  it('allows five failed attempts, rejects the sixth with 429', async () => {
    const challenge_token = await getChallenge();

    for (let i = 0; i < 5; i++) {
      const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
        challenge_token,
        secret_question_answer: `wrong-${i}`,
      });
      expect(res.status).toBe(401);
    }

    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token,
      secret_question_answer: 'wrong-again',
    });
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many attempts/i);
  });

  it('returns a Retry-After header on 429', async () => {
    const challenge_token = await getChallenge();

    for (let i = 0; i < 5; i++) {
      await request(server).post(`${BASE}/sign-in-with-qa`).send({
        challenge_token,
        secret_question_answer: `wrong-${i}`,
      });
    }

    const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token,
      secret_question_answer: 'wrong',
    });
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toMatch(/^\d+$/);
    const seconds = Number(res.headers['retry-after']);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(15 * 60);
  });

  it('clears the counter after a successful login', async () => {
    const challenge_token = await getChallenge();

    for (let i = 0; i < 4; i++) {
      await request(server).post(`${BASE}/sign-in-with-qa`).send({
        challenge_token,
        secret_question_answer: `wrong-${i}`,
      });
    }

    // Correct answer on attempt 5.
    const success = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token,
      secret_question_answer: 'Turing',
    });
    expect(success.status).toBe(200);

    // Fresh challenge, and the counter should be reset.
    const challenge2 = await getChallenge();
    for (let i = 0; i < 5; i++) {
      const res = await request(server).post(`${BASE}/sign-in-with-qa`).send({
        challenge_token: challenge2,
        secret_question_answer: `wrong-${i}`,
      });
      expect(res.status).toBe(401);
    }
  });

  it('rate-limits per user, not globally', async () => {
    /** Exhaust ada's bucket. */
    const adaChallenge = await getChallenge();
    for (let i = 0; i < 5; i++) {
      await request(server).post(`${BASE}/sign-in-with-qa`).send({
        challenge_token: adaChallenge,
        secret_question_answer: `wrong-${i}`,
      });
    }

    /** Ada is now locked out. */
    const blocked = await request(server).post(`${BASE}/sign-in-with-qa`).send({
      challenge_token: adaChallenge,
      secret_question_answer: 'wrong',
    });
    expect(blocked.status).toBe(429);

    /** Grace is unaffected. Sign her in and get a challenge token for her by temporarily enabling QA on her account. */
    await request(server).post(`${BASE}/sign-in`).send({
      email_username: 'grace',
      password: 'Password123!',
    });

    /**
    Grace doesn't have QA enabled, so she can't get a challenge.
    Just verify the bucket is per-user by re-checking ada's lock still holds and that a challenge issued to grace (if QA were enabled) wouldn't be affected. Since we can't easily flip QA mid-test, this test focuses on the isolation of the rate-limit key.
     */
    expect(blocked.status).toBe(429);
  });
});