import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js';
import asServer from './helpers/asServer.js';
import { bearerFor } from './helpers/auth.js';
import dbClient from '../config/db/dbClient.js';
import { setupSchema, resetAndSeed, teardown } from './setup.js';

/** A well-formed UUID that isn't assigned to any seeded user. */
// const MISSING_UUID = '00000000-0000-0000-0000-000000000000';
const server = asServer(app);

jest.setTimeout(30_000);

beforeAll(setupSchema);
afterAll(teardown);

let ctx, ACME, ACME_TT;

beforeEach(async () => {
  ctx = await resetAndSeed();
  ACME = ctx.businessIds['Acme Coffee'];
  ACME_TT = ctx.transactionTypeIds['Bean purchase'];
});

const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });
const asGrace = () => bearerFor({ id: ctx.userIds.grace, role: 'user' });
const asStranger = () => bearerFor({ id: ctx.userIds.stranger, role: 'user' });

// const txBase = `/api/v1/businesses/${ACME}/transactions`;
// const auditBase = `/api/v1/businesses/${ACME}/audit-events`;
const txBase = () => `/api/v1/businesses/${ACME}/transactions`;
const auditBase = () => `/api/v1/businesses/${ACME}/audit-events`;

async function createTx(overrides = {}) {
  const res = await request(server)
    .post(txBase())
    .set('Authorization', asAda())
    .send({
      transaction_type_id: ACME_TT,
      narration: 'Test',
      amount: 10000,
      currency: 'GBP',
      ...overrides,
    });
  return res.body.data;
}

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/audit-events
* ---------------------------------------------------
*/
describe('GET /businesses/:businessId/audit-events', () => {
  it('returns events for the business, newest first', async () => {
    await createTx();
    await createTx();

    const res = await request(server).get(auditBase()).set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every(e => e.business_id === ACME)).toBe(true);
    expect(res.body.data[0].action).toBe('created');
  });

  it('filters by subject_type', async () => {
    await createTx();
    const res = await request(server)
      .get(`${auditBase()}?subject_type=transaction`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.every(e => e.subject_type === 'transaction')).toBe(true);
  });

  it('filters by actor_id', async () => {
    await createTx();
    const res = await request(server)
      .get(`${auditBase()}?actor_id=${ctx.userIds.ada}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.every(e => e.actor_id === ctx.userIds.ada)).toBe(true);
  });

  it('filters by action', async () => {
    const tx = await createTx();
    await request(server)
      .patch(`${txBase()}/${tx.id}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    const res = await request(server)
      .get(`${auditBase()}?action=approved`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].subject_id).toBe(tx.id);
  });

  it('stranger gets 404', async () => {
    const res = await request(server).get(auditBase()).set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });

  it('rejects an invalid subject_type filter with 400', async () => {
    const res = await request(server)
      .get(`${auditBase()}?subject_type=garbage`)
      .set('Authorization', asAda());
    expect(res.status).toBe(400);
  });

  /**
  it('returns events for the business, newest first', async () => {
    // console.log('DBG ctx keys:', Object.keys(ctx || {}));
    // console.log('DBG ACME:', ACME, typeof ACME);
    // console.log('DBG ACME_TT:', ACME_TT, typeof ACME_TT);
  
    await createTx();
    await createTx();
  
    const res = await request(server).get(auditBase()).set('Authorization', asAda());
    console.log('DBG audit status:', res.status, 'body:', JSON.stringify(res.body));
    expect(res.status).toBe(200);
    // ...
  });
  */
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transactions/:id/events
* ---------------------------------------------------
*/
describe('GET /businesses/:businessId/transactions/:id/events', () => {
  it('returns the transaction trail in chronological order', async () => {
    const tx = await createTx();
    await request(server)
      .patch(`${txBase()}/${tx.id}`)
      .set('Authorization', asAda())
      .send({ narration: 'Edited' });

    const res = await request(server)
      .get(`${txBase()}/${tx.id}/events`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.map(e => e.action)).toEqual(['created', 'updated']);
    expect(res.body.data[1].payload.changes.narration).toBe('Edited');
  });

  it('records approval with the acting user', async () => {
    const tx = await createTx();
    await request(server)
      .patch(`${txBase()}/${tx.id}`)
      .set('Authorization', asGrace())
      .send({ approved: true });

    const res = await request(server)
      .get(`${txBase()}/${tx.id}/events`)
      .set('Authorization', asAda());
    const approved = res.body.data.find(e => e.action === 'approved');
    expect(approved.actor_id).toBe(ctx.userIds.grace);
  });

  it('records a reversal pair', async () => {
    const tx = await createTx();
    await request(server)
      .patch(`${txBase()}/${tx.id}`)
      .set('Authorization', asAda())
      .send({ approved: true });

    const rev = await request(server)
      .post(`${txBase()}/${tx.id}/reverse`)
      .set('Authorization', asAda())
      .send({});

    const original = await request(server)
      .get(`${txBase()}/${tx.id}/events`)
      .set('Authorization', asAda());
    const reversed = original.body.data.find(e => e.action === 'reversed');
    expect(reversed.payload.reversal_id).toBe(rev.body.data.id);

    const reversal = await request(server)
      .get(`${txBase()}/${rev.body.data.id}/events`)
      .set('Authorization', asAda());
    expect(reversal.body.data[0].action).toBe('created');
    expect(reversal.body.data[0].payload.reverses_transaction_id).toBe(tx.id);
  });

  it('a soft-deleted transaction returns 404 for its events', async () => {
    const tx = await createTx();
    await request(server)
      .delete(`${txBase()}/${tx.id}`)
      .set('Authorization', asAda());

    const res = await request(server)
      .get(`${txBase()}/${tx.id}/events`)
      .set('Authorization', asAda());
    expect(res.status).toBe(404);
  });

  it('the audit trail survives soft-deletion, visible via the general endpoint', async () => {
    const tx = await createTx();
    await request(server)
      .delete(`${txBase()}/${tx.id}`)
      .set('Authorization', asAda());

    const res = await request(server)
      .get(`${auditBase()}?subject_type=transaction&subject_id=${tx.id}`)
      .set('Authorization', asAda());
    expect(res.status).toBe(200);
    expect(res.body.data.map(e => e.action).sort()).toEqual(['created', 'deleted']);
  });

  it('stranger gets 404', async () => {
    const tx = await createTx();
    const res = await request(server)
      .get(`${txBase()}/${tx.id}/events`)
      .set('Authorization', asStranger());
    expect(res.status).toBe(404);
  });
});

/**
* ---------------------------------------------------
* Additional tests for transaction types and businesses
* ---------------------------------------------------
*/
describe('audit events for other subject types', () => {
  it('records transaction_type creation', async () => {
    await request(server)
      .post(`/api/v1/businesses/${ACME}/transaction-types`)
      .set('Authorization', asAda())
      .send({ name: 'Payroll', description: 'Monthly payroll.' });

    const res = await request(server)
      .get(`/api/v1/businesses/${ACME}/audit-events?subject_type=transaction_type`)
      .set('Authorization', asAda());
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].action).toBe('created');
  });

  it('records business creation', async () => {
    await request(server)
      .post('/api/v1/businesses')
      .set('Authorization', asAda())
      .send({ name: 'New Co', description: 'Fresh.' });

    const res = await request(server)
      .get(`/api/v1/businesses/${ACME}/audit-events?subject_type=business`)
      .set('Authorization', asAda());
    /** The audit event carries business_id = the new business's id, not ACME's. So this query against ACME won't see it. Check directly: */
    const { rows } = await dbClient.query(
      `SELECT subject_type, action FROM audit_events WHERE subject_type = 'business' ORDER BY id DESC LIMIT 1`
    );
    expect(rows[0].subject_type).toBe('business');
    expect(rows[0].action).toBe('created');
  });
});