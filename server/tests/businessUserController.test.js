import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js';
import asServer from './helpers/asServer.js';
import { bearerFor } from './helpers/auth.js';
import { setupSchema, resetAndSeed, teardown } from './setup.js';

const server = asServer(app);
const BASE = '/api/v1/businesses';

jest.setTimeout(30_000);

beforeAll(setupSchema);
afterAll(teardown);

let ctx, ACME, BETA;

beforeEach(async () => {
  ctx = await resetAndSeed();
  ACME = ctx.businessIds['Acme Coffee'];
  BETA = ctx.businessIds['Beta Freight'];
});

const asAda = () => bearerFor({ id: ctx.userIds.ada,       role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace,     role: 'user' });
const asAlan = () => bearerFor({ id: ctx.userIds.alan,      role: 'user' });
const asSiteAdmin = () => bearerFor({ id: ctx.userIds.siteadmin, role: 'admin' });
const asStranger = () => bearerFor({ id: ctx.userIds.stranger,  role: 'user' });

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:id/members
* ---------------------------------------------------
*/
describe('GET /api/v1/businesses/:id/members', () => {
  it('owner can list members', async () => {
    const res = await request(server).get(`${BASE}/${ACME}/members`).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map(m => m.username).sort()).toEqual(['ada', 'grace']);
  });

  it('connected member can list', async () => {
    const res = await request(server).get(`${BASE}/${BETA}/members`).set('Authorization', asAlan());
    expect(res.status).toBe(200);
  });

  it('site admin can list any business', async () => {
    const res = await request(server).get(`${BASE}/${ACME}/members`).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
  });

  it('stranger gets 404', async () => {
    const res = await request(server).get(`${BASE}/${ACME}/members`).set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('user connected to a different business gets 404', async () => {
    const res = await request(server).get(`${BASE}/${BETA}/members`).set('Authorization', asGrace());
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server).get(`${BASE}/${ACME}/members`);
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* POST /api/v1/businesses/:id/members
* ---------------------------------------------------
*/
describe('POST /api/v1/businesses/:id/members', () => {
  it('owner can add a member', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda())
      .send({ user_id: ctx.userIds.alan, role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('alan');
    expect(res.body.data.role).toBe('member');
  });

  it('business admin can add a member', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asGrace())
      .send({ user_id: ctx.userIds.alan, role: 'member' });
    expect(res.status).toBe(201);
  });

  it('site admin can add a member', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asSiteAdmin())
      .send({ user_id: ctx.userIds.stranger, role: 'member' });
    expect(res.status).toBe(201);
  });

  it('ordinary member cannot add', async () => {
    const res = await request(server)
      .post(`${BASE}/${BETA}/members`)
      .set('Authorization', asAlan())
      .send({ user_id: ctx.userIds.stranger, role: 'member' });
    expect(res.status).toBe(404);
  });

  it('stranger cannot add', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asStranger())
      .send({ user_id: ctx.userIds.alan, role: 'member' });
    expect(res.status).toBe(404);
  });

  it('rejects duplicate membership with 409', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda())
      .send({ user_id: ctx.userIds.grace, role: 'member' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already a member/i);
  });

  it('rejects nonexistent user with 404', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda())
      .send({ user_id: 99999, role: 'member' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid role with 422', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda())
      .send({ user_id: ctx.userIds.alan, role: 'superuser' });
    expect(res.status).toBe(422);
  });

  it('rejects missing user_id with 422', async () => {
    const res = await request(server)
      .post(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda())
      .send({ role: 'member' });
    expect(res.status).toBe(422);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:id/members/:userId
* ---------------------------------------------------
*/
describe('PATCH /api/v1/businesses/:id/members/:userId', () => {
  it('owner can change a member role', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}/members/${ctx.userIds.grace}`)
      .set('Authorization', asAda())
      .send({ role: 'member' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('member');
  });

  it('ordinary member cannot change roles', async () => {
    const res = await request(server)
      .patch(`${BASE}/${BETA}/members/${ctx.userIds.ada}`)
      .set('Authorization', asAlan())
      .send({ role: 'member' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-member', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}/members/${ctx.userIds.stranger}`)
      .set('Authorization', asAda())
      .send({ role: 'member' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid role with 422', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}/members/${ctx.userIds.grace}`)
      .set('Authorization', asAda())
      .send({ role: 'superuser' });
    expect(res.status).toBe(422);
  });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:id/members/:userId
* ---------------------------------------------------
*/
describe('DELETE /api/v1/businesses/:id/members/:userId', () => {
  it('owner can remove a member', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}/members/${ctx.userIds.grace}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Business member removed');

    const after = await request(server)
      .get(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda());
    expect(after.body.total).toBe(1);
  });

  it('ordinary member cannot remove', async () => {
    const res = await request(server)
      .delete(`${BASE}/${BETA}/members/${ctx.userIds.ada}`)
      .set('Authorization', asAlan());
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-member', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}/members/${ctx.userIds.stranger}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(404);
  });

  it('site admin can remove', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}/members/${ctx.userIds.grace}`)
      .set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}/members/${ctx.userIds.grace}`);
    expect(res.status).toBe(401);
  });
});