import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../../index.js';
import asServer from '../helpers/asServer.js';
import { setupSchema, resetAndSeed, teardown } from '../setup.js';

import dbClient from '../../config/db/dbClient.js';

const server = asServer(app);
const BASE = '/api/v1/auth';

jest.setTimeout(30_000);

/**
beforeAll(setupSchema);
beforeEach(resetAndSeed);
afterAll(teardown);
*/

let ctx;

beforeAll(setupSchema);
beforeEach(async () => { ctx = await resetAndSeed(); });
afterAll(teardown);

async function freshAgentSignedIn() {
  const agent = request.agent(server);
  await agent.post(`${BASE}/sign-in`).send({
    email_username: 'grace',
    password: 'Password123!',
  });
  return agent;
}

describe('POST /api/v1/auth/refresh-token', () => {
  it('issues a new access token from the refresh cookie', async () => {
    const agent = await freshAgentSignedIn();
    const res = await agent.post(`${BASE}/refresh-token`);
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
  });

  it('rejects a request with no cookie', async () => {
    const res = await request(server).post(`${BASE}/refresh-token`);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid cookie with 403', async () => {
    const res = await request(server)
      .post(`${BASE}/refresh-token`)
      .set('Cookie', 'jwt=not-a-valid-jwt');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/auth/sign-out', () => {
  it('clears the refresh cookie', async () => {
    const agent = await freshAgentSignedIn();
    const res = await agent.post(`${BASE}/sign-out`);
    expect(res.status).toBe(200);

    const cleared = res.headers['set-cookie']?.find(c => c.startsWith('jwt='));
    expect(cleared).toBeDefined();
    /** Express writes an expired empty cookie: jwt=; Expires=Thu, 01 Jan 1970... */
    expect(cleared).toMatch(/jwt=;/);
  });

  it('succeeds even without a cookie', async () => {
    const res = await request(server).post(`${BASE}/sign-out`);
    expect(res.status).toBe(200);
  });

  it('rejects a refresh token issued before a password change', async () => {
    const agent = request.agent(server);
    await agent.post(`${BASE}/sign-in`).send({
      email_username: 'grace',
      password: 'Password123!',
    });
  
    /** Someone changes the password out-of-band. */
    await dbClient.query(
      `UPDATE users SET password_changed_at = CURRENT_TIMESTAMP + INTERVAL '1 minute'
       WHERE id = $1`,
      [ctx.userIds.grace]
    );
  
    const res = await agent.post(`${BASE}/refresh-token`);
    expect(res.status).toBe(401);
  });
});