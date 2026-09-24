import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js';
import asServer from './helpers/asServer.js';
import { bearerFor } from './helpers/auth.js';
import dbClient from '../config/db/dbClient.js';
import { setupSchema, resetAndSeed, teardown } from './setup.js';

const server = asServer(app);

jest.setTimeout(30_000);

beforeAll(setupSchema);
afterAll(teardown);

let ctx, ACME;

beforeEach(async () => {
  ctx = await resetAndSeed();
  ACME = ctx.businessIds['Acme Coffee'];
});

const asAda = () => bearerFor({ id: ctx.userIds.ada, role: 'user' });

async function seedOneEvent() {
  await request(server)
    .post(`/api/v1/businesses/${ACME}/transaction-types`)
    .set('Authorization', asAda())
    .send({ name: 'Append-Only Test', description: 'Just for this test.' });
}


describe('audit_events append-only guarantee', () => {
  it('rejects UPDATE on a stored event', async () => {
    await seedOneEvent();

    const { rows } = await dbClient.query(
      'SELECT id FROM audit_events ORDER BY id DESC LIMIT 1'
    );
    const id = rows[0].id;

    await expect(
      dbClient.query(`UPDATE audit_events SET action = 'tampered' WHERE id = $1`, [id])
    ).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE on a stored event', async () => {
    await seedOneEvent();

    const { rows } = await dbClient.query(
      'SELECT id FROM audit_events ORDER BY id DESC LIMIT 1'
    );
    const id = rows[0].id;

    await expect(
      dbClient.query('DELETE FROM audit_events WHERE id = $1', [id])
    ).rejects.toThrow(/append-only/);
  });

  it('still allows INSERT (the append path)', async () => {
    await seedOneEvent();

    await expect(
      dbClient.query(
        `INSERT INTO audit_events (actor_id, subject_type, subject_id, action)
         VALUES ($1, 'business', $2, 'test_insert')`,
        [ctx.userIds.ada, ACME]
      )
    ).resolves.toBeDefined();

    const { rows } = await dbClient.query(
      `SELECT COUNT(*)::int AS total FROM audit_events WHERE action = 'test_insert'`
    );
    expect(rows[0].total).toBe(1);
  });

  it('allows TRUNCATE (used by test setup)', async () => {
    await seedOneEvent();

    await expect(
      dbClient.query('TRUNCATE audit_events')
    ).resolves.toBeDefined();
  });

  it('auth_events: rejects UPDATE', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });

    const { rows } = await dbClient.query(
      'SELECT id FROM auth_events ORDER BY id DESC LIMIT 1'
    );
    const id = rows[0].id;

    await expect(
      dbClient.query(`UPDATE auth_events SET event_type = 'tampered' WHERE id = $1`, [id])
    ).rejects.toThrow(/append-only/);
  });

  it('auth_events: rejects DELETE', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });

    const { rows } = await dbClient.query(
      'SELECT id FROM auth_events ORDER BY id DESC LIMIT 1'
    );
    const id = rows[0].id;

    await expect(
      dbClient.query('DELETE FROM auth_events WHERE id = $1', [id])
    ).rejects.toThrow(/append-only/);
  });
});


/**
describe('audit_events append-only guarantee', () => {
  it('rejects UPDATE on a stored event', async () => {
    await seedOneEvent();

    await expect(
      dbClient.query(`UPDATE audit_events SET action = 'tampered' WHERE id = 1`)
    ).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE on a stored event', async () => {
    await seedOneEvent();

    await expect(
      dbClient.query('DELETE FROM audit_events WHERE id = 1')
    ).rejects.toThrow(/append-only/);
  });

  it('still allows INSERT (the append path)', async () => {
    await seedOneEvent();

    await expect(
      dbClient.query(
        `INSERT INTO audit_events (actor_id, subject_type, subject_id, action)
         VALUES ($1, 'business', $2, 'test_insert')`,
        [ctx.userIds.ada, ACME]
      )
    ).resolves.toBeDefined();

    const { rows } = await dbClient.query(
      `SELECT COUNT(*)::int AS total FROM audit_events WHERE action = 'test_insert'`
    );
    expect(rows[0].total).toBe(1);
  });

  it('allows TRUNCATE (used by test setup)', async () => {
    await seedOneEvent();

    // TRUNCATE fires TRUNCATE triggers, not DELETE triggers. Our test setup relies on this — verify the escape hatch still works. 
    await expect(
      dbClient.query('TRUNCATE audit_events')
    ).resolves.toBeDefined();
  });

  it('auth_events: rejects UPDATE', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
  
    await expect(
      dbClient.query(`UPDATE auth_events SET event_type = 'tampered' WHERE id = 1`)
    ).rejects.toThrow(/append-only/);
  });
  
  it('auth_events: rejects DELETE', async () => {
    await request(server).post('/api/v1/auth/sign-in').send({
      email_username: 'grace',
      password: 'Password123!',
    });
  
    await expect(
      dbClient.query('DELETE FROM auth_events WHERE id = 1')
    ).rejects.toThrow(/append-only/);
  });
});
*/