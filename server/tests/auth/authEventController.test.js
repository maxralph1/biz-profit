import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../../index.js';
import asServer from '../helpers/asServer.js';
import { bearerFor } from '../helpers/auth.js';
import dbClient from '../../config/db/dbClient.js';
import { setupSchema, resetAndSeed, teardown } from '../setup.js';

const server = asServer(app);

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

async function eventTypesFor(userId) {
  const { rows } = await dbClient.query(
    'SELECT event_type FROM auth_events WHERE user_id = $1 ORDER BY id ASC',
    [userId]
  );
  return rows.map((r) => r.event_type);
}

/**
* ---------------------------------------------------
* Events are written on auth actions
* ---------------------------------------------------
*/
describe('auth event writes', () => {
  it('records login_succeeded on password-only sign-in', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });

    const types = await eventTypesFor(ctx.userIds.grace);
    expect(types).toContain('login_succeeded');
  });

  it('records login_failed with a reason for a wrong password', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'WrongPassword!',
    });

    const { rows } = await dbClient.query(
      `SELECT event_type, metadata FROM auth_events
       WHERE user_id = $1 AND event_type = 'login_failed'`,
      [ctx.userIds.grace]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata.reason).toBe('wrong_password');
  });

  it('records login_failed for an unknown identifier with null user_id', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'nobody@example.com',
      password: 'Password123!',
    });

    const { rows } = await dbClient.query(
      `SELECT user_id, attempted_identifier, metadata FROM auth_events
       WHERE event_type = 'login_failed' AND user_id IS NULL`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attempted_identifier).toBe('nobody@example.com');
    expect(rows[0].metadata.reason).toBe('unknown_user');
  });

  it('records login_qa_challenge_issued then login_qa_succeeded', async () => {
    const challenge = await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'ada',
      password: 'Password123!',
    });
    await request(server).post('/api/v1/auth/sign-in-with-qa').send({
      challenge_token: challenge.body.data.challenge_token,
      secret_question_answer: 'Turing',
    });

    const types = await eventTypesFor(ctx.userIds.ada);
    expect(types).toContain('login_qa_challenge_issued');
    expect(types).toContain('login_qa_succeeded');
  });

  it('records login_qa_failed on a wrong answer', async () => {
    const challenge = await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'ada',
      password: 'Password123!',
    });
    await request(server).post('/api/v1/auth/sign-in-with-qa').send({
      challenge_token: challenge.body.data.challenge_token,
      secret_question_answer: 'Wrong',
    });

    expect(await eventTypesFor(ctx.userIds.ada)).toContain('login_qa_failed');
  });

  it('records refresh_succeeded', async () => {
    const agent = request.agent(server);
    await agent.post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
    await agent.post('/api/v1/auth/refresh-token');

    expect(await eventTypesFor(ctx.userIds.grace)).toContain('refresh_succeeded');
  });

  it('records refresh_failed with a reason', async () => {
    await request(server).post('/api/v1/auth/refresh-token');

    const { rows } = await dbClient.query(
      `SELECT metadata FROM auth_events WHERE event_type = 'refresh_failed'`
    );
    expect(rows[0].metadata.reason).toBe('no_cookie');
  });

  it('records verification_succeeded', async () => {
    await request(server).post('/api/v1/auth/sign-up').send({
      first_name: 'New',
      last_name: 'User',
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'Password123!',
      country_phone_code: '+1',
    });

    const { rows } = await dbClient.query(
      'SELECT id, verification_code FROM users WHERE email = $1',
      ['newuser@example.com']
    );
    await request(server).post('/api/v1/auth/verify').send({
      email: 'newuser@example.com',
      code: rows[0].verification_code,
    });

    const events = await eventTypesFor(rows[0].id);
    expect(events).toContain('verification_succeeded');
  });

  it('records password_reset_requested and password_reset_completed', async () => {
    await request(server).post('/api/v1/auth/mail-password-reset-link').send({
      email: 'grace@example.com',
    });

    const { rows } = await dbClient.query(
      'SELECT password_reset_token FROM users WHERE id = $1',
      [ctx.userIds.grace]
    );

    await request(server).put('/api/v1/auth/password-reset').send({
      token: rows[0].password_reset_token,
      password: 'BrandNew123!',
    });

    const events = await eventTypesFor(ctx.userIds.grace);
    expect(events).toContain('password_reset_requested');
    expect(events).toContain('password_reset_completed');
  });

  it('records signout', async () => {
    const agent = request.agent(server);
    await agent.post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
    await agent.post('/api/v1/auth/sign-out');

    /** signout has no req.user (route not authenticated), so user_id may be null. */
    const { rows } = await dbClient.query(
      `SELECT event_type FROM auth_events WHERE event_type = 'signout'`
    );
    expect(rows).toHaveLength(1);
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/auth-events/my-auth-events
* ---------------------------------------------------
*/
describe('GET /api/v1/auth-events/my-auth-events', () => {
  it('returns only the caller\'s events', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'ada',
      password: 'Password123!',
    });

    const res = await request(server)
      .get('/api/v1/auth-events/my-auth-events')
      .set('Authorization', asGrace());

    expect(res.status).toBe(200);
    expect(res.body.data.every((e) => e.user_id === ctx.userIds.grace)).toBe(true);
    expect(res.body.data[0].event_type).toBe('login_succeeded');
  });

  it('requires authentication', async () => {
    const res = await request(server).get('/api/v1/auth-events/my-auth-events');
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/auth-events   - (admin only)
* ---------------------------------------------------
*/
describe('GET /api/v1/auth-events', () => {
  beforeEach(async () => {
    // Produce a mixed set of events across two users.
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Wrong!',
    });
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'ada',
      password: 'Password123!',
    });
  });

  it('admin can list all events', async () => {
    const res = await request(server)
      .get('/api/v1/auth-events')
      .set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  it('filters by user_id', async () => {
    const res = await request(server)
      .get(`/api/v1/auth-events?user_id=${ctx.userIds.grace}`)
      .set('Authorization', asSiteAdmin());
    expect(res.body.data.every((e) => e.user_id === ctx.userIds.grace)).toBe(true);
  });

  it('filters by event_type', async () => {
    const res = await request(server)
      .get('/api/v1/auth-events?event_type=login_failed')
      .set('Authorization', asSiteAdmin());
    expect(res.body.data.every((e) => e.event_type === 'login_failed')).toBe(true);
  });

  it('filters by attempted_identifier', async () => {
    const res = await request(server)
      .get('/api/v1/auth-events?attempted_identifier=grace')
      .set('Authorization', asSiteAdmin());
    expect(res.body.data.every((e) => e.attempted_identifier === 'grace')).toBe(true);
  });

  it('rejects a non-admin with 403', async () => {
    const res = await request(server)
      .get('/api/v1/auth-events')
      .set('Authorization', asGrace());
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(server).get('/api/v1/auth-events');
    expect(res.status).toBe(401);
  });
});