import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js';
import asServer from './helpers/asServer.js';
import { bearerFor } from './helpers/auth.js';
import { setupSchema, resetAndSeed, teardown } from './setup.js';

const server = asServer(app);

jest.setTimeout(30_000);

beforeAll(setupSchema);
afterAll(teardown);

let ctx, ACME, BETA;

beforeEach(async () => {
  ctx = await resetAndSeed();
  ACME = ctx.businessIds['Acme Coffee'];
  BETA = ctx.businessIds['Beta Freight'];
});

const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace, role: 'user' });
const asAlan = () => bearerFor({ id: ctx.userIds.alan, role: 'user' });
const asSiteAdmin = () => bearerFor({ id: ctx.userIds.siteadmin, role: 'admin' });
const asStranger = () => bearerFor({ id: ctx.userIds.stranger, role: 'user' });

const base = (bizId) => `/api/v1/businesses/${bizId}/transaction-types`;

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transaction-types
* ---------------------------------------------------
*/
describe('GET transaction-types list', () => {
  it('owner can list', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data.every(t => t.business_id === ACME)).toBe(true);
  });

  it('connected member can list', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asGrace());
    expect(res.status).toBe(200);
  });

  it('site admin can list', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asSiteAdmin());
    expect(res.status).toBe(200);
  });

  it('stranger gets 404', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('user of another business gets 404', async () => {
    const res = await request(server).get(base(BETA)).set('Authorization', asGrace());
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server).get(base(ACME));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------


/**
* ---------------------------------------------------
* POST /api/v1/businesses/:businessId/transaction-types
* ---------------------------------------------------
*/
describe('POST transaction-types', () => {
  it('owner can create', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ name: 'Utilities', description: 'Power and water.' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Utilities');
    expect(res.body.data.type).toBe('debit');
    expect(res.body.data.user_id).toBe(ctx.userIds.ada);
  });

  it('business admin can create', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asGrace())
      .send({ name: 'Packaging', description: 'Cups and lids.', type: 'debit' });
    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(ctx.userIds.grace);
  });

  it('site admin can create', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asSiteAdmin())
      .send({ name: 'Depreciation', description: 'Fixed asset depreciation.', type: 'debit' });
    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(ctx.userIds.siteadmin);
  });

  it('rejects a duplicate name with 409', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ name: 'Rent', description: 'Clashing name.' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('allows the same name in a different business', async () => {
    const res = await request(server)
      .post(base(BETA))
      .set('Authorization', asAda())
      .send({ name: 'Rent', description: 'Beta rent.' });
    expect(res.status).toBe(201);
  });

  it('rejects an invalid type with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ name: 'Payroll', description: 'x', type: 'transfer' });
    expect(res.status).toBe(422);
  });

  it('rejects a missing name with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ description: 'No name.' });
    expect(res.status).toBe(422);
  });

  it('rejects a missing description with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ name: 'Payroll' });
    expect(res.status).toBe(422);
  });

  it('ignores a client-supplied user_id', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ name: 'Sneaky', description: 'x', user_id: ctx.userIds.stranger });
    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(ctx.userIds.ada);
  });

  it('ordinary member cannot create', async () => {
    const res = await request(server)
      .post(base(BETA))
      .set('Authorization', asAlan())
      .send({ name: 'Anything', description: 'x' });
    expect(res.status).toBe(404);
  });

  it('stranger cannot create', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asStranger())
      .send({ name: 'Anything', description: 'x' });
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server)
      .post(base(ACME))
      .send({ name: 'x', description: 'y' });
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transaction-types/:id
* ---------------------------------------------------
*/
describe('GET single transaction-type', () => {
  let acmeTypeId;

  beforeEach(async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asAda());
    acmeTypeId = res.body.data[0].id;
  });

  it('owner can fetch', async () => {
    const res = await request(server)
      .get(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(acmeTypeId);
  });

  it('connected member can fetch', async () => {
    const res = await request(server)
      .get(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asGrace());
    expect(res.status).toBe(200);
  });

  it('stranger gets 404', async () => {
    const res = await request(server)
      .get(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('returns 404 when id exists but belongs to another business', async () => {
    const res = await request(server)
      .get(`${base(BETA)}/${acmeTypeId}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(server)
      .get(`${base(ACME)}/abc`)
      .set('Authorization', asAda());
    expect(res.status).toBe(400);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/transaction-types/:id
* ---------------------------------------------------
*/
describe('PATCH transaction-type', () => {
  let acmeTypeId;

  beforeEach(async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asAda());
    acmeTypeId = res.body.data[0].id;
  });

  it('business admin can update', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asGrace())
      .send({ name: 'Updated name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated name');
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid type with 422', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asAda())
      .send({ type: 'whatever' });
    expect(res.status).toBe(422);
  });

  it('rejects a duplicate name with 409', async () => {
    const all = await request(server).get(base(ACME)).set('Authorization', asAda());
    const other = all.body.data.find(t => t.id !== acmeTypeId);
    const res = await request(server)
      .patch(`${base(ACME)}/${acmeTypeId}`)
      .set('Authorization', asAda())
      .send({ name: other.name });
    expect(res.status).toBe(409);
  });

  it('ordinary member cannot update', async () => {
    const betaList = await request(server).get(base(BETA)).set('Authorization', asAda());
    const betaId = betaList.body.data[0].id;
    const res = await request(server)
      .patch(`${base(BETA)}/${betaId}`)
      .set('Authorization', asAlan())
      .send({ name: 'Anything' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when id belongs to another business', async () => {
    const res = await request(server)
      .patch(`${base(BETA)}/${acmeTypeId}`)
      .set('Authorization', asAda())
      .send({ name: 'Moved' });
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/transaction-types/:id
* ---------------------------------------------------
*/
describe('DELETE transaction-type', () => {
  it('business admin can delete a fresh type', async () => {
    const created = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ name: 'Throwaway', description: 'Temp.' });
    const id = created.body.data.id;

    const res = await request(server)
      .delete(`${base(ACME)}/${id}`)
      .set('Authorization', asGrace());
    expect(res.status).toBe(200);
  });

  it('returns 409 when transactions reference the type', async () => {
    const list = await request(server).get(base(ACME)).set('Authorization', asAda());
    /**
    Seed creates transactions against 'Bean purchase' and 'Cup sale'.
    Find whichever is currently referenced; the seed guarantees at least one is.
    */
    const referenced = list.body.data.find(t => t.name === 'Bean purchase');
    const res = await request(server)
      .delete(`${base(ACME)}/${referenced.id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/referenced by existing transactions/i);
  });

  it('returns 404 when id belongs to another business', async () => {
    const acme = await request(server).get(base(ACME)).set('Authorization', asAda());
    const id = acme.body.data[0].id;
    const res = await request(server)
      .delete(`${base(BETA)}/${id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(404);
  });

  it('ordinary member cannot delete', async () => {
    const beta = await request(server).get(base(BETA)).set('Authorization', asAda());
    const id = beta.body.data[0].id;
    const res = await request(server)
      .delete(`${base(BETA)}/${id}`)
      .set('Authorization', asAlan());
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const acme = await request(server).get(base(ACME)).set('Authorization', asAda());
    const id = acme.body.data[0].id;
    const res = await request(server).delete(`${base(ACME)}/${id}`);
    expect(res.status).toBe(401);
  });
});