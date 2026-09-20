import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../index.js';
import asServer from '../helpers/asServer.js';
import { bearerFor } from '../helpers/auth.js';
import { setupSchema, resetAndSeed, teardown } from '../setup.js';

const server = asServer(app);
const PROBE = '/api/v1/businesses';

jest.setTimeout(30_000);

beforeAll(setupSchema);
afterAll(teardown);

let ctx;
beforeEach(async () => { ctx = await resetAndSeed(); });

describe('authenticated middleware', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(server).get(PROBE);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentication required');
  });

  it('rejects a non-Bearer scheme', async () => {
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token with 401', async () => {
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = jwt.sign(
      { user: { id: ctx.userIds.siteadmin, role: 'admin' } },
      'wrong-secret'
    );
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign(
      { user: { id: ctx.userIds.siteadmin, role: 'admin' } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: -1 }
    );
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token with no user payload', async () => {
    const token = jwt.sign({}, process.env.ACCESS_TOKEN_SECRET);
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('passes with a valid admin token', async () => {
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', bearerFor({ id: ctx.userIds.siteadmin, role: 'admin' }));
    expect(res.status).toBe(200);
  });

  it('passes authentication but is rejected by isAdmin for a non-admin', async () => {
    const res = await request(server)
      .get(PROBE)
      .set('Authorization', bearerFor({ id: ctx.userIds.grace, role: 'user' }));
    expect(res.status).toBe(403);
  });
});