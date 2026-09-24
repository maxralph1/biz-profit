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

/** A well-formed UUID that isn't assigned to any seeded user. */
const MISSING_UUID = '00000000-0000-0000-0000-000000000000';

const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace, role: 'user' });
const asAlan = () => bearerFor({ id: ctx.userIds.alan, role: 'user' });
const asStranger = () => bearerFor({ id: ctx.userIds.stranger, role: 'user' });

const base = (bizId) => `/api/v1/businesses/${bizId}/monthly-totals`;

const VALID = () => ({
  narration: 'Test month net',
  amount: 250000,
  currency: 'GBP',
  month_in_review: '2025-03',
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/monthly-totals
* ---------------------------------------------------
*/
describe('GET monthly totals list', () => {
  it('owner can list', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.every(m => m.business_id === ACME)).toBe(true);
  });

  it('stranger gets 404', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server).get(base(ACME));
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* POST /api/v1/businesses/:businessId/monthly-totals
* ---------------------------------------------------
*/
describe('POST monthly totals', () => {
  it('owner can create — month normalized to day 1', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    expect(res.status).toBe(201);
    //expect(res.body.data.month_in_review).toMatch(/^2025-03-01/);
    expect(res.body.data.month_in_review).toBe('2025-03-01');
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.approver_id).toBeNull();
    expect(res.body.data.created_by).toBe(ctx.userIds.ada);
    expect(res.body.data.amount).toBe('250000');
  });

  it('accepts a full date and normalizes to day 1', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), month_in_review: '2025-04-17' });
    expect(res.status).toBe(201);
    //expect(res.body.data.month_in_review).toMatch(/^2025-04-01/);
    expect(res.body.data.month_in_review).toBe('2025-04-01');
  });

  it('rejects an invalid month with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), month_in_review: 'not-a-month' });
    expect(res.status).toBe(422);
    expect(res.body.errors.month_in_review).toBeDefined();
  });

  it('rejects month 13 with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), month_in_review: '2025-13' });
    expect(res.status).toBe(422);
  });

  it('rejects a zero amount with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: 0 });
    expect(res.status).toBe(422);
  });

  it('accepts a negative amount', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: -250000 });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe('-250000');
  });

  it('rejects a duplicate (business, month, currency) with 409', async () => {
    await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());

    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), narration: 'Different narration, same keys' });
    expect(res.status).toBe(409);
  });

  it('allows the same month and currency in a different business', async () => {
    await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());

    const res = await request(server)
      .post(base(BETA))
      .set('Authorization', asAda())
      .send({ ...VALID(), month_in_review: '2025-03' });
    expect(res.status).toBe(201);
  });

  it('ordinary member cannot create', async () => {
    const res = await request(server)
      .post(base(BETA))
      .set('Authorization', asAlan())
      .send(VALID());
    expect(res.status).toBe(404);
  });

  it('stranger cannot create', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asStranger())
      .send(VALID());
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/monthly-totals/:id
* ---------------------------------------------------
*/
describe('GET single monthly total', () => {
  let id;

  beforeEach(async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    id = res.body.data.id;
  });

  it('owner can fetch', async () => {
    const res = await request(server)
      .get(`${base(ACME)}/${id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('returns 404 when id belongs to another business', async () => {
    const res = await request(server)
      .get(`${base(BETA)}/${id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(404);
  });

  it('stranger gets 404', async () => {
    const res = await request(server)
      .get(`${base(ACME)}/${id}`)
      .set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/monthly-totals/:id
* ---------------------------------------------------
*/
describe('PATCH monthly totals', () => {
  let id;

  beforeEach(async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    id = res.body.data.id;
  });

  it('business admin can update narration', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asGrace())
      .send({ narration: 'Updated net' });
    expect(res.status).toBe(200);
    expect(res.body.data.narration).toBe('Updated net');
  });

  it('approve sets approver_id to the acting user', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asGrace())
      .send({ approved: true });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.approver_id).toBe(ctx.userIds.grace);
  });

  it('rejects any edit to an approved monthly total with 409', async () => {
    await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    const res = await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAda())
      .send({ narration: 'Too late' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cannot be edited/i);
  });

  it('rejects a change that collides with an existing month with 409', async () => {
    await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), month_in_review: '2025-05' });

    const res = await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAda())
      .send({ month_in_review: '2025-05' });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid month with 422', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAda())
      .send({ month_in_review: 'abc' });
    expect(res.status).toBe(422);
  });

  it('ordinary member cannot update', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAlan())
      .send({ narration: 'Hijack' });
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/monthly-totals/:id
* ---------------------------------------------------
*/
describe('DELETE monthly totals', () => {
  let id;

  beforeEach(async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    id = res.body.data.id;
  });

  it('owner can delete an unapproved monthly total', async () => {
    const res = await request(server)
      .delete(`${base(ACME)}/${id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);

    const after = await request(server)
      .get(`${base(ACME)}/${id}`)
      .set('Authorization', asAda());
    expect(after.status).toBe(404);
  });

  it('owner can delete an approved monthly total', async () => {
    await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    const res = await request(server)
      .delete(`${base(ACME)}/${id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
  });

  it('deleting an approved monthly total frees the (business, month, currency) slot', async () => {
    await request(server)
      .patch(`${base(ACME)}/${id}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    await request(server)
      .delete(`${base(ACME)}/${id}`)
      .set('Authorization', asAda());

    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: 999999 });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe('999999');
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(server)
      .delete(`${base(ACME)}/${MISSING_UUID}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(404);
  });

  it('ordinary member cannot delete', async () => {
    const res = await request(server)
      .delete(`${base(ACME)}/${id}`)
      .set('Authorization', asAlan());
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server).delete(`${base(ACME)}/${id}`);
    expect(res.status).toBe(401);
  });
});