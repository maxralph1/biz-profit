import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js';
import asServer from './helpers/asServer.js';
import { bearerFor } from './helpers/auth.js';
import { setupSchema, resetAndSeed, teardown } from './setup.js';

/** A well-formed UUID that isn't assigned to any seeded user. */
const MISSING_UUID = '00000000-0000-0000-0000-000000000000';
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

/** Fixture tokens — signed with the real accessTokenSigning so tests exercise the actual token format the middleware sees. */
const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace, role: 'user' });
const asAlan = () => bearerFor({ id: ctx.userIds.alan, role: 'user' });
const asSiteAdmin = () => bearerFor({ id: ctx.userIds.siteadmin,role: 'admin' });
const asStranger = () => bearerFor({ id: ctx.userIds.stranger, role: 'user' });

/**
* ---------------------------------------------------
* GET /api/v1/businesses   (site admin only)
* ---------------------------------------------------
*/
describe('GET /api/v1/businesses', () => {
  it('returns paginated businesses for a site admin', async () => {
    const res = await request(server).get(BASE).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.current_page).toBe(1);
  });

  it('rejects an ordinary user with 403', async () => {
    const res = await request(server).get(BASE).set('Authorization', asGrace());
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(server).get(BASE);
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/me
* ---------------------------------------------------
*/
describe('GET /api/v1/businesses/me', () => {
  it('returns only businesses the user is connected to', async () => {
    const res = await request(server).get(`${BASE}/me`).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const names = res.body.data.map(b => b.name).sort();
    expect(names).toEqual(['Acme Coffee', 'Beta Freight']);
  });

  it('returns a single business for a business admin', async () => {
    const res = await request(server).get(`${BASE}/me`).set('Authorization', asGrace());
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Acme Coffee');
    expect(res.body.data[0].membership_role).toBe('admin');
  });

  it('returns an empty list for a stranger', async () => {
    const res = await request(server).get(`${BASE}/me`).set('Authorization', asStranger());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('requires authentication', async () => {
    const res = await request(server).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* POST /api/v1/businesses
* ---------------------------------------------------
*/
describe('POST /api/v1/businesses', () => {
  it('creates a business owned by the requesting user', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asGrace())
      .send({ name: 'Grace Consulting', description: 'Independent consulting.' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Grace Consulting');
    expect(res.body.data.user_id).toBe(ctx.userIds.grace);
  });

  it('ignores a client-supplied user_id', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asGrace())
      .send({ name: 'Sneaky Co', description: 'x', user_id: ctx.userIds.stranger });

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(ctx.userIds.grace);
  });

  it('rejects a missing name with 422', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asGrace())
      .send({ description: 'No name.' });
    expect(res.status).toBe(422);
    expect(res.body.errors.name).toBe('name is required');
  });

  it('requires authentication', async () => {
    const res = await request(server).post(BASE).send({ name: 'x', description: 'y' });
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:id   - the visibility rule
* ---------------------------------------------------
*/
describe('GET /api/v1/businesses/:id', () => {
  it('site admin sees any business', async () => {
    const res = await request(server).get(`${BASE}/${ACME}`).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ACME);
  });

  it('owner sees own business', async () => {
    const res = await request(server).get(`${BASE}/${ACME}`).set('Authorization', asAda());
    expect(res.status).toBe(200);
  });

  it('connected member sees their business', async () => {
    const res = await request(server).get(`${BASE}/${BETA}`).set('Authorization', asAlan());
    expect(res.status).toBe(200);
  });

  it('unconnected user gets 404 (does not leak existence)', async () => {
    /** Grace is admin of Acme, but has no link to Beta. */
    const res = await request(server).get(`${BASE}/${BETA}`).set('Authorization', asGrace());
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Business not found');
  });

  it('stranger gets 404', async () => {
    const res = await request(server).get(`${BASE}/${ACME}`).set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('nonexistent id gets 404', async () => {
    const res = await request(server).get(`${BASE}/${MISSING_UUID}`).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(404);
  });

  /**
  it('non-numeric id gets 400', async () => {
    const res = await request(server).get(`${BASE}/abc`).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(400);
  });
  */

  it('returns 400 for a malformed id', async () => {
  const res = await request(server)
    .get(`${BASE}/not-a-uuid`)
    .set('Authorization', asSiteAdmin());
  expect(res.status).toBe(400);
});

  it('requires authentication', async () => {
    const res = await request(server).get(`${BASE}/${ACME}`);
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:id
* ---------------------------------------------------
*/
describe('PATCH /api/v1/businesses/:id', () => {
  it('owner can update', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}`)
      .set('Authorization', asAda())
      .send({ name: 'Acme Coffee Roasters' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Acme Coffee Roasters');
  });

  it('business admin (non-owner) can update', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}`)
      .set('Authorization', asGrace())
      .send({ description: 'Updated by Grace.' });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated by Grace.');
  });

  it('ordinary member gets 404', async () => {
    /** Alan is a 'member' (not 'admin') in Beta. */
    const res = await request(server)
      .patch(`${BASE}/${BETA}`)
      .set('Authorization', asAlan())
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('stranger gets 404', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}`)
      .set('Authorization', asStranger())
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('site admin can update any business', async () => {
    const res = await request(server)
      .patch(`${BASE}/${BETA}`)
      .set('Authorization', asSiteAdmin())
      .send({ name: 'Beta Freight Ltd' });
    expect(res.status).toBe(200);
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No updatable fields provided');
  });

  it('drops non-whitelisted fields and rejects the empty result', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ACME}`)
      .set('Authorization', asAda())
      .send({ user_id: ctx.userIds.stranger });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(server).patch(`${BASE}/${ACME}`).send({ name: 'x' });
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:id
* ---------------------------------------------------
*/
describe('DELETE /api/v1/businesses/:id', () => {
  it('owner can delete a childless business', async () => {
    const created = await request(server)
      .post(BASE)
      .set('Authorization', asGrace())
      .send({ name: 'Doomed Co', description: 'Short-lived.' });
    const newId = created.body.data.id;

    const res = await request(server)
      .delete(`${BASE}/${newId}`)
      .set('Authorization', asGrace());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Business deleted');

    const after = await request(server)
      .get(`${BASE}/${newId}`)
      .set('Authorization', asGrace());
    expect(after.status).toBe(404);
  });

  /**
  it('returns 409 when the business has children', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cannot delete/i);
  });
  */

  it('soft-deletes a business even when it has children', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Business deleted');
  
    /** Parent gone from the API */
    const gone = await request(server)
      .get(`${BASE}/${ACME}`)
      .set('Authorization', asAda());
    expect(gone.status).toBe(404);
  
    /** Children unreachable — their routes call loadVisibleBusiness/loadManageableBusiness first, which now filter deleted businesses */
    const members = await request(server)
      .get(`${BASE}/${ACME}/members`)
      .set('Authorization', asAda());
    expect(members.status).toBe(404);
  
    const txs = await request(server)
      .get(`${BASE}/${ACME}/transactions`)
      .set('Authorization', asAda());
    expect(txs.status).toBe(404);
  });

  it('ordinary member gets 404', async () => {
    const res = await request(server)
      .delete(`${BASE}/${BETA}`)
      .set('Authorization', asAlan());
    expect(res.status).toBe(404);
  });

  it('stranger gets 404', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ACME}`)
      .set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server).delete(`${BASE}/${ACME}`);
    expect(res.status).toBe(401);
  });
});