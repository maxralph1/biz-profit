import 'dotenv/config';
import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../../index.js';
import asServer from '../helpers/asServer.js';
import dbClient from '../../config/db/dbClient.js';
import {
  fetchVerificationCode,
  fetchEmailVerified,
  expireVerificationCode,
} from '../helpers/db.js';
import { setupSchema, resetAndSeed, teardown } from '../setup.js';

const server = asServer(app);
const BASE = '/api/v1/auth';

jest.setTimeout(30_000);

beforeAll(setupSchema);
beforeEach(resetAndSeed);
afterAll(teardown);

const NEW_USER = {
  first_name: 'Katherine',
  last_name: 'Johnson',
  username: 'katherine',
  email: 'katherine@example.com',
  password: 'Password123!',
  country_phone_code: '+1',
  phone_number: '2025559999',
};

describe('POST /api/v1/auth/sign-up', () => {
  it('creates an unverified user and issues a 6-digit code', async () => {
    const res = await request(server).post(`${BASE}/sign-up`).send(NEW_USER);
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(NEW_USER.email);

    const code = await fetchVerificationCode(NEW_USER.email);
    expect(code).toMatch(/^\d{6}$/);
    expect(await fetchEmailVerified(NEW_USER.email)).toBe(false);
  });

  it('rejects duplicate username with 409', async () => {
    const res = await request(server)
      .post(`${BASE}/sign-up`)
      .send({ ...NEW_USER, username: 'ada' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Username already taken');
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(server)
      .post(`${BASE}/sign-up`)
      .send({ ...NEW_USER, email: 'ada@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
  });

  it('rejects a malformed email with 422', async () => {
    const res = await request(server)
      .post(`${BASE}/sign-up`)
      .send({ ...NEW_USER, email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.errors.email).toBe('email must be a valid email');
  });

  it('rejects a short password with 422', async () => {
    const res = await request(server)
      .post(`${BASE}/sign-up`)
      .send({ ...NEW_USER, password: 'short' });
    expect(res.status).toBe(422);
  });

  it('ignores a client-supplied role', async () => {
    const res = await request(server)
      .post(`${BASE}/sign-up`)
      .send({ ...NEW_USER, role: 'admin' });
    expect(res.status).toBe(201);

    const { rows } = await dbClient.query(
      'SELECT role FROM users WHERE email = $1',
      [NEW_USER.email]
    );
    expect(rows[0].role).toBe('user');
  });
});

describe('POST /api/v1/auth/verify', () => {
  beforeEach(async () => {
    await request(server).post(`${BASE}/sign-up`).send(NEW_USER);
  });

  it('verifies the account with the correct code', async () => {
    const code = await fetchVerificationCode(NEW_USER.email);
    const res = await request(server)
      .post(`${BASE}/verify`)
      .send({ email: NEW_USER.email, code });

    expect(res.status).toBe(200);
    expect(await fetchEmailVerified(NEW_USER.email)).toBe(true);
    expect(await fetchVerificationCode(NEW_USER.email)).toBeNull();
  });

  it('rejects a wrong code with 400', async () => {
    const res = await request(server)
      .post(`${BASE}/verify`)
      .send({ email: NEW_USER.email, code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid verification code');
  });

  it('rejects an unknown email with 400', async () => {
    const res = await request(server)
      .post(`${BASE}/verify`)
      .send({ email: 'nobody@example.com', code: '123456' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired code with 400', async () => {
    const code = await fetchVerificationCode(NEW_USER.email);
    await expireVerificationCode(NEW_USER.email);

    const res = await request(server)
      .post(`${BASE}/verify`)
      .send({ email: NEW_USER.email, code });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('rejects double verification with 409', async () => {
    const code = await fetchVerificationCode(NEW_USER.email);
    await request(server)
      .post(`${BASE}/verify`)
      .send({ email: NEW_USER.email, code });

    const res = await request(server)
      .post(`${BASE}/verify`)
      .send({ email: NEW_USER.email, code });
    expect(res.status).toBe(409);
  });
});

/**
* ---------------------------------------------------
* End-to-end
* ---------------------------------------------------
*/
describe('sign-up → verify → sign-in', () => {
  it('gates sign-in on verification', async () => {
    await request(server).post(`${BASE}/sign-up`).send(NEW_USER);

    const blocked = await request(server).post(`${BASE}/sign-in`).send({
      email_username: NEW_USER.email,
      password: NEW_USER.password,
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/not verified/i);

    const code = await fetchVerificationCode(NEW_USER.email);
    await request(server)
      .post(`${BASE}/verify`)
      .send({ email: NEW_USER.email, code });

    const signed = await request(server).post(`${BASE}/sign-in`).send({
      email_username: NEW_USER.email,
      password: NEW_USER.password,
    });
    expect(signed.status).toBe(200);
    expect(signed.body.access_token).toBeTruthy();
  });
});