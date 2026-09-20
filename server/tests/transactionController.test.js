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

let ctx, ACME, BETA, ACME_TT;

beforeEach(async () => {
  ctx = await resetAndSeed();
  ACME = ctx.businessIds['Acme Coffee'];
  BETA = ctx.businessIds['Beta Freight'];
  ACME_TT = ctx.transactionTypeIds['Bean purchase'];
});

const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace, role: 'user' });
const asAlan = () => bearerFor({ id: ctx.userIds.alan, role: 'user' });
const asSiteAdmin = () => bearerFor({ id: ctx.userIds.siteadmin, role: 'admin' });
const asStranger = () => bearerFor({ id: ctx.userIds.stranger, role: 'user' });

const base = (bizId) => `/api/v1/businesses/${bizId}/transactions`;

const VALID = () => ({
  transaction_type_id: ACME_TT,
  narration: 'Test purchase',
  amount: 12345,
  currency: 'GBP',
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transactions
* ---------------------------------------------------
*/
describe('GET transactions list', () => {
  it('owner can list', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every(t => t.business_id === ACME)).toBe(true);
  });

  it('amount is returned as a string', async () => {
    const res = await request(server).get(base(ACME)).set('Authorization', asAda());
    expect(typeof res.body.data[0].amount).toBe('string');
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
* POST /api/v1/businesses/:businessId/transactions
* ---------------------------------------------------
*/
describe('POST transactions', () => {
  it('owner can create — returned unapproved', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    expect(res.status).toBe(201);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.approver_id).toBeNull();
    expect(res.body.data.created_by).toBe(ctx.userIds.ada);
    expect(res.body.data.amount).toBe('12345');
  });

  it('accepts amount as a string', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: '999' });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe('999');
  });

  /**
  it('rejects a negative amount with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: -1 });
    expect(res.status).toBe(422);
  });
  */
  it('accepts a negative amount (money out)', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: -1 });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe('-1');
  });
  
  it('rejects a zero amount with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: 0 });
    expect(res.status).toBe(422);
  });

  it('rejects a lowercase currency with 422', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), currency: 'gbp' });
    expect(res.status).toBe(422);
  });

  it('rejects a transaction_type from another business with 422', async () => {
    const betaTT = ctx.transactionTypeIds['Fuel'];
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), transaction_type_id: betaTT });
    expect(res.status).toBe(422);
    expect(res.body.errors.transaction_type_id).toMatch(/does not belong/i);
  });

  it('ignores a client-supplied approved flag', async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), approved: true, approver_id: ctx.userIds.ada });
    expect(res.status).toBe(201);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.approver_id).toBeNull();
  });

  it('ordinary member cannot create', async () => {
    const res = await request(server)
      .post(base(BETA))
      .set('Authorization', asAlan())
      .send({ ...VALID(), transaction_type_id: ctx.transactionTypeIds['Fuel'] });
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/transactions/:id   - including approve / unapprove
* ---------------------------------------------------
*/
describe('PATCH transactions', () => {
  let txId;

  beforeEach(async () => {
    const res = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    txId = res.body.data.id;
  });

  it('can update narration', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ narration: 'Updated narration' });
    expect(res.status).toBe(200);
    expect(res.body.data.narration).toBe('Updated narration');
  });

  it('approve sets approver_id to the acting user', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asGrace())
      .send({ approved: true });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.approver_id).toBe(ctx.userIds.grace);
  });

  /**
  it('unapprove clears approver_id', async () => {
    await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    const res = await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ approved: false });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.approver_id).toBeNull();
  });
  */
  it('rejects any modification to an approved transaction', async () => {
    await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ approved: true });
  
    const res = await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ narration: 'Too late' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cannot be modified/i);
  });
  
  it('rejects DELETE on an approved transaction', async () => {
    await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ approved: true });
  
    const res = await request(server)
      .delete(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(409);
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(400);
  });

  it('ordinary member cannot update', async () => {
    const res = await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAlan())
      .send({ narration: 'Hijack' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when id belongs to another business', async () => {
    const res = await request(server)
      .patch(`${base(BETA)}/${txId}`)
      .set('Authorization', asAda())
      .send({ narration: 'Moved' });
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/transactions/:id
* ---------------------------------------------------
*/
describe('DELETE transactions', () => {
  it('business admin can delete', async () => {
    const created = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());
    const id = created.body.data.id;

    const res = await request(server)
      .delete(`${base(ACME)}/${id}`)
      .set('Authorization', asGrace());
    expect(res.status).toBe(200);
  });

  it('ordinary member cannot delete', async () => {
    const res = await request(server)
      .delete(`${base(ACME)}/1`)
      .set('Authorization', asAlan());
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* POST /api/v1/businesses/:businessId/transactions/:id/reverse
* ---------------------------------------------------
*/
describe('POST /businesses/:id/transactions/:id/reverse', () => {
  let txId;

  beforeEach(async () => {
    const created = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send({ ...VALID(), amount: 50000 });
    txId = created.body.data.id;

    await request(server)
      .patch(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda())
      .send({ approved: true });
  });

  it('creates a negative-amount reversal linked to the original', async () => {
    const res = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe('-50000');
    expect(res.body.data.reverses_transaction_id).toBe(txId);
    expect(res.body.data.approved).toBe(false);
    expect(res.body.data.created_by).toBe(ctx.userIds.ada);
  });

  it('marks the original as reversed on subsequent GET', async () => {
    await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});

    const res = await request(server)
      .get(`${base(ACME)}/${txId}`)
      .set('Authorization', asAda());
    expect(res.body.data.is_reversed).toBe(true);
    expect(res.body.data.reverses_transaction_id).toBeNull();
  });

  it('accepts a caller-supplied narration', async () => {
    const res = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({ narration: 'Duplicate entry — reversing.' });
    expect(res.body.data.narration).toBe('Duplicate entry — reversing.');
  });

  it('rejects reversing an unapproved transaction with 409', async () => {
    const draft = await request(server)
      .post(base(ACME))
      .set('Authorization', asAda())
      .send(VALID());

    const res = await request(server)
      .post(`${base(ACME)}/${draft.body.data.id}/reverse`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only approved/i);
  });

  it('rejects a second reversal of the same transaction with 409', async () => {
    await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});

    const res = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(409);
  });

  it('rejects reversing a reversal with 409', async () => {
    const created = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});
    const reversalId = created.body.data.id;

    await request(server)
      .patch(`${base(ACME)}/${reversalId}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    const res = await request(server)
      .post(`${base(ACME)}/${reversalId}/reverse`)
      .set('Authorization', asAda())
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/reversal entry/i);
  });

  it('ordinary member cannot reverse', async () => {
    const res = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAlan())
      .send({});
    expect(res.status).toBe(404);
  });

  it('stranger cannot reverse', async () => {
    const res = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asStranger())
      .send({});
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(server).post(`${base(ACME)}/${txId}/reverse`);
    expect(res.status).toBe(401);
  });

  /** */
  it('rejects changing a reversal\'s amount with 409', async () => {
    const created = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});
    const reversalId = created.body.data.id;
  
    const res = await request(server)
      .patch(`${base(ACME)}/${reversalId}`)
      .set('Authorization', asAda())
      .send({ amount: 999 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only allows narration/i);
  });
  
  it('allows approving a reversal', async () => {
    const created = await request(server)
      .post(`${base(ACME)}/${txId}/reverse`)
      .set('Authorization', asAda())
      .send({});
    const reversalId = created.body.data.id;
  
    const res = await request(server)
      .patch(`${base(ACME)}/${reversalId}`)
      .set('Authorization', asAda())
      .send({ approved: true });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.approver_id).toBe(ctx.userIds.ada);
  });
  /** */
});