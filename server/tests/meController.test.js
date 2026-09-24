import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js';
import asServer from './helpers/asServer.js';
import { bearerFor } from './helpers/auth.js';
import dbClient from '../config/db/dbClient.js';
import { setupSchema, resetAndSeed, teardown } from './setup.js';

const server = asServer(app);
const BASE = '/api/v1/me';

jest.setTimeout(30_000);

beforeAll(setupSchema);
afterAll(teardown);

let ctx;

beforeEach(async () => {
  ctx = await resetAndSeed();
});

const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace, role: 'user' });
const asSiteAdmin = () => bearerFor({ id: ctx.userIds.siteadmin, role: 'admin' });

async function readUser(id) {
  const { rows } = await dbClient.query(
    'SELECT email, email_verified, username, role, secret_question_login, verification_code FROM users WHERE id = $1',
    [id]
  );
  return rows[0];
}

/**
* ---------------------------------------------------
* GET /api/v1/me
* ---------------------------------------------------
*/
describe('GET /api/v1/me', () => {
  it('returns the authenticated user', async () => {
    const res = await request(server).get(BASE).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ctx.userIds.ada);
    expect(res.body.data.username).toBe('ada');
  });

  it('does not leak password or secret_question_answer', async () => {
    const res = await request(server).get(BASE).set('Authorization', asAda());
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.secret_question_answer).toBeUndefined();
    expect(res.body.data.verification_code).toBeUndefined();
  });

  it('works for any authenticated role', async () => {
    const res = await request(server).get(BASE).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });

  it('requires authentication', async () => {
    const res = await request(server).get(BASE);
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/me   - basics
* ---------------------------------------------------
*/
describe('PATCH /api/v1/me', () => {
  it('updates a single field', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ first_name: 'Gracie' });
    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Gracie');
    expect(res.body.data.last_name).toBe('Hopper');
  });

  it('updates multiple fields', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ first_name: 'Gracie', last_name: 'Hopper-Smith', phone_number: '2025550199' });
    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Gracie');
    expect(res.body.data.last_name).toBe('Hopper-Smith');
    expect(res.body.data.phone_number).toBe('2025550199');
  });

  it('updates username', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ username: 'grace_h' });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('grace_h');
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(server).patch(BASE).set('Authorization', asGrace()).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No updatable fields provided');
  });

  it('rejects a body of only unknown fields with 400', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ role: 'admin', email_verified: true });
    expect(res.status).toBe(400);
  });

  it('rejects a short username with 422', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ username: 'ab' });
    expect(res.status).toBe(422);
  });

  it('rejects a duplicate username with 409', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ username: 'ada' });
    expect(res.status).toBe(409);
  });

  it('allows keeping the same username (no false 409)', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ username: 'grace' });
    expect(res.status).toBe(200);
  });

  it('ignores a client-supplied role', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ first_name: 'Gracie', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('user');
    expect((await readUser(ctx.userIds.grace)).role).toBe('user');
  });

  it('requires authentication', async () => {
    const res = await request(server).patch(BASE).send({ first_name: 'X' });
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/me   - QA opt-in
* ---------------------------------------------------
*/
describe('PATCH /api/v1/me — enabling QA', () => {
  it('enables QA when both question and answer are supplied', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({
        secret_question_login: true,
        secret_question: 'Favorite language?',
        secret_question_answer: 'COBOL',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.secret_question_login).toBe(true);

    const row = await readUser(ctx.userIds.grace);
    expect(row.secret_question_login).toBe(true);
  });

  it('rejects enabling QA without the answer', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ secret_question_login: true, secret_question: 'Favorite language?' });
    expect(res.status).toBe(422);
    expect(res.body.errors.secret_question_answer).toBeDefined();
  });

  it('rejects enabling QA without the question', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ secret_question_login: true, secret_question_answer: 'COBOL' });
    expect(res.status).toBe(422);
    expect(res.body.errors.secret_question).toBeDefined();
  });

  it('allows disabling QA with just the flag', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asAda())
      .send({ secret_question_login: false });
    expect(res.status).toBe(200);
    expect(res.body.data.secret_question_login).toBe(false);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/me   - email change
* ---------------------------------------------------
*/
describe('PATCH /api/v1/me — email change', () => {
  it('unverifies the account and issues a new code', async () => {
    const before = await readUser(ctx.userIds.grace);
    expect(before.email_verified).toBe(true);

    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ email: 'grace.new@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('grace.new@example.com');
    expect(res.body.data.email_verified).toBe(false);

    const after = await readUser(ctx.userIds.grace);
    expect(after.email).toBe('grace.new@example.com');
    expect(after.email_verified).toBe(false);
    expect(after.verification_code).toMatch(/^\d{6}$/);
  });

  it('does not reset verification when email is unchanged', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ email: 'grace@example.com', first_name: 'Grace' });
    expect(res.status).toBe(200);
    expect(res.body.data.email_verified).toBe(true);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ email: 'ada@example.com' });
    expect(res.status).toBe(409);
  });

  it('leaves the current session valid (access token still works)', async () => {
    await request(server)
      .patch(BASE)
      .set('Authorization', asGrace())
      .send({ email: 'grace.new@example.com' });

    const res = await request(server).get(BASE).set('Authorization', asGrace());
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('grace.new@example.com');
  });
});

/**
* ---------------------------------------------------
* Refresh token survives username change
* ---------------------------------------------------
*/
describe('refresh after username change', () => {
  it('issues a new access token even when the username changed', async () => {
    const agent = request.agent(server);
    await agent.post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });

    /** Change username using the current access token. */
    const cookies = agent.jar.getCookies({ domain: 'localhost', path: '/' });
    /** The refresh cookie is httpOnly; supertest's agent carries it across requests. */

    await agent.patch(BASE).send({ username: 'grace_h' });

    const refreshed = await agent.post('/api/v1/auth/refresh-token');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).toBeTruthy();
  });
});

/**
* ---------------------------------------------------
* PUT /api/v1/me/password   - Profile (authenticated user) Password Reset
* ---------------------------------------------------
*/
describe('PUT /api/v1/me/password', () => {
  const NEW_PASSWORD = 'NewPassword456!';

  it('changes the password and issues fresh tokens', async () => {
    const res = await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', asGrace())
      .send({
        current_password: 'Password123!',
        new_password: NEW_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toMatch(/^jwt=/);
  });

  it('new password works for sign-in', async () => {
    await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', asGrace())
      .send({ current_password: 'Password123!', new_password: NEW_PASSWORD });

    const res = await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
  });

  it('old password no longer works for sign-in', async () => {
    await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', asGrace())
      .send({ current_password: 'Password123!', new_password: NEW_PASSWORD });

    const res = await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong current password with 401', async () => {
    const res = await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', asGrace())
      .send({ current_password: 'WrongPassword!', new_password: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects a short new password with 422', async () => {
    const res = await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', asGrace())
      .send({ current_password: 'Password123!', new_password: 'short' });
    expect(res.status).toBe(422);
  });

  it('rejects a new password identical to the current one', async () => {
    const res = await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', asGrace())
      .send({ current_password: 'Password123!', new_password: 'Password123!' });
    expect(res.status).toBe(422);
    expect(res.body.errors.new_password).toBeDefined();
  });

  it('requires authentication', async () => {
    const res = await request(server)
      .put(`${BASE}/password`)
      .send({ current_password: 'Password123!', new_password: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('invalidates refresh tokens issued before the change', async () => {
    /** Sign in as grace to get a refresh cookie (fresh agent). */
    const agent = request.agent(server);
    await agent.post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });

    await new Promise((r) => setTimeout(r, 1100));

    /** Password change happens via a *separate* client (direct request with grace's access token), NOT through the agent. This simulates another device changing the password while the agent's session stays as-is. */
    const access = bearerFor({ id: ctx.userIds.grace, role: 'user' });
    await request(server)
      .put(`${BASE}/password`)
      .set('Authorization', access)
      .send({ current_password: 'Password123!', new_password: 'NewPassword456!' });

    /** Give jwt's iat enough room to be strictly less than password_changed_at. */
    // await new Promise((r) => setTimeout(r, 1100));

    /** The agent's refresh token is now stale. */
    const refreshed = await agent.post('/api/v1/auth/refresh-token');
    expect(refreshed.status).toBe(401);
  });

  it('the fresh refresh token from the password-change response is not rejected', async () => {
    const agent = request.agent(server);
    await agent.post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });

    /** Through the agent so its cookie is overwitten by the response */
    // const access = bearerFor({ id: ctx.userIds.grace, role: 'user' });
    await agent
      .put(`${BASE}/password`)
      //.set('Authorization', access)
      .send({ current_password: 'Password123!', new_password: 'NewPassword456!' });
  
    const refreshed = await agent.post('/api/v1/auth/refresh-token');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).toBeTruthy();
  });
});