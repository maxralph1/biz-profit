import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import router from '../routes/api.js';
const app = router;
import { setupSchema, resetAndSeed, teardown } from './setup.js';

const BASE = '/api/v1/users';

const VALID_NEW_USER = {
  first_name: 'Linus',
  last_name: 'Torvalds',
  username: 'linus',
  email: 'linus@example.com',
  password: 'Password123!',
  secret_question: 'First pet?',
  secret_question_answer: 'Tux',
  country_phone_code: '+358',
};

before(setupSchema);
beforeEach(resetAndSeed);
after(teardown);

// ---------------------------------------------------------------------------
// GET /api/users
// ---------------------------------------------------------------------------

describe('GET /api/v1/users', () => {
  it('returns paginated users with default page size', async () => {
    const res = await request(app).get(BASE);
    assert.equal(res.status, 200);
    assert.equal(res.body.current_page, 1);
    assert.equal(res.body.per_page, 10);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.last_page, 1);
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.from, 1);
    assert.equal(res.body.to, 3);
  });

  it('respects per_page', async () => {
    const res = await request(app).get(`${BASE}?per_page=2`);
    assert.equal(res.body.per_page, 2);
    assert.equal(res.body.last_page, 2);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.next_page_url.includes('page=2'), true);
  });

  it('returns the correct slice on page 2', async () => {
    const res = await request(app).get(`${BASE}?per_page=2&page=2`);
    assert.equal(res.body.current_page, 2);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.from, 3);
    assert.equal(res.body.to, 3);
    assert.equal(res.body.prev_page_url.includes('page=1'), true);
  });

  it('returns empty data for pages beyond the end', async () => {
    const res = await request(app).get(`${BASE}?page=99`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.from, null);
    assert.equal(res.body.to, null);
    assert.equal(res.body.next_page_url, null);
  });

  it('clamps per_page to a maximum of 100', async () => {
    const res = await request(app).get(`${BASE}?per_page=9999`);
    assert.equal(res.body.per_page, 100);
  });

  it('clamps page 0 to 1', async () => {
    const res = await request(app).get(`${BASE}?page=0`);
    assert.equal(res.body.current_page, 1);
  });

  it('falls back to page 1 for non-numeric page', async () => {
    const res = await request(app).get(`${BASE}?page=abc`);
    assert.equal(res.body.current_page, 1);
  });

  it('does not leak password or secret_question_answer fields', async () => {
    const res = await request(app).get(BASE);
    for (const u of res.body.data) {
      assert.equal(u.password, undefined);
      assert.equal(u.password_reset_token, undefined);
      assert.equal(u.password_reset_token_expires_at, undefined);
      assert.equal(u.secret_question_answer, undefined);
    }
  });

  it('includes Laravel-shaped pagination links', async () => {
    const res = await request(app).get(`${BASE}?per_page=2`);
    assert.ok(Array.isArray(res.body.links));
    assert.equal(res.body.links[0].label, '« Previous');
    assert.equal(res.body.links.at(-1).label, 'Next »');
    assert.equal(res.body.prev_page_url, null);
    assert.match(res.body.first_page_url, /page=1/);
    assert.match(res.body.last_page_url, /page=2/);
  });
});

// ---------------------------------------------------------------------------
// POST /api/users
// ---------------------------------------------------------------------------

describe('POST /api/v1/users', () => {
  it('creates a user and returns 201 with the public shape', async () => {
    const res = await request(app).post(BASE).send(VALID_NEW_USER);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.username, 'linus');
    assert.equal(res.body.data.email, 'linus@example.com');
    assert.equal(res.body.data.role, 'user');
    assert.equal(res.body.data.password, undefined);
    assert.equal(res.body.data.secret_question_answer, undefined);
    assert.ok(res.body.data.id);
  });

  it('forces role to "user" even if client supplies "admin"', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ ...VALID_NEW_USER, role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'user');
  });

  it('rejects a missing email with 422', async () => {
    const { email, ...body } = VALID_NEW_USER;
    const res = await request(app).post(BASE).send(body);
    assert.equal(res.status, 422);
    assert.equal(res.body.errors.email, 'email is required');
  });

  it('rejects a malformed email with 422', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ ...VALID_NEW_USER, email: 'not-an-email' });
    assert.equal(res.status, 422);
    assert.equal(res.body.errors.email, 'email must be a valid email');
  });

  it('rejects a short password with 422', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ ...VALID_NEW_USER, password: 'short' });
    assert.equal(res.status, 422);
    assert.match(res.body.errors.password, /at least 8 characters/);
  });

  it('returns 409 on duplicate username', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ ...VALID_NEW_USER, username: 'ada' });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'Username already taken');
  });

  it('returns 409 on duplicate email', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ ...VALID_NEW_USER, email: 'ada@example.com' });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'Email already registered');
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/users/:id', () => {
  it('returns a single user without leaking secrets', async () => {
    const res = await request(app).get(`${BASE}/1`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 1);
    assert.equal(res.body.data.password, undefined);
    assert.equal(res.body.data.secret_question_answer, undefined);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get(`${BASE}/abc`);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid user id');
  });

  it('returns 400 for a non-positive id', async () => {
    const res = await request(app).get(`${BASE}/0`);
    assert.equal(res.status, 400);
  });

  it('returns 404 for a missing user', async () => {
    const res = await request(app).get(`${BASE}/9999`);
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'User not found');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/users/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/users/:id', () => {
  it('updates only the supplied fields', async () => {
    const before = await request(app).get(`${BASE}/2`);
    const res = await request(app)
      .patch(`${BASE}/2`)
      .send({ first_name: 'Graceful' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.first_name, 'Graceful');
    assert.equal(res.body.data.last_name, before.body.data.last_name);
    assert.equal(res.body.data.email, before.body.data.email);
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(app).patch(`${BASE}/2`).send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'No updatable fields provided');
  });

  it('rejects a body of only unknown fields with 400', async () => {
    const res = await request(app)
      .patch(`${BASE}/2`)
      .send({ admin: true, role: 'admin' });
    assert.equal(res.status, 400);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).patch(`${BASE}/abc`).send({ first_name: 'X' });
    assert.equal(res.status, 400);
  });

  it('returns 404 for a missing user', async () => {
    const res = await request(app)
      .patch(`${BASE}/9999`)
      .send({ first_name: 'X' });
    assert.equal(res.status, 404);
  });

  it('returns 409 on duplicate email against another user', async () => {
    const res = await request(app)
      .patch(`${BASE}/2`)
      .send({ email: 'ada@example.com' });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'Email already registered');
  });

  it('allows updating own email to the same value (no false 409)', async () => {
    const res = await request(app)
      .patch(`${BASE}/2`)
      .send({ email: 'grace@example.com' });
    assert.equal(res.status, 200);
  });

  it('rejects a short username with 422', async () => {
    const res = await request(app)
      .patch(`${BASE}/2`)
      .send({ username: 'ab' });
    assert.equal(res.status, 422);
    assert.match(res.body.errors.username, /at least 3 characters/);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/users/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/users/:id', () => {
  it('deletes a user with no activity', async () => {
    const created = await request(app).post(BASE).send(VALID_NEW_USER);
    const id = created.body.data.id;

    const res = await request(app).delete(`${BASE}/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'User deleted');

    const after = await request(app).get(`${BASE}/${id}`);
    assert.equal(after.status, 404);
  });

  it('returns 409 when the user owns a business', async () => {
    const res = await request(app).delete(`${BASE}/1`); // ada
    assert.equal(res.status, 409);
    assert.match(res.body.message, /own businesses/i);
  });

  it('returns 409 when the user has memberships', async () => {
    const res = await request(app).delete(`${BASE}/3`); // alan — member of Beta
    assert.equal(res.status, 409);
    assert.match(res.body.message, /referenced/i);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).delete(`${BASE}/abc`);
    assert.equal(res.status, 400);
  });

  it('returns 404 for a missing user', async () => {
    const res = await request(app).delete(`${BASE}/9999`);
    assert.equal(res.status, 404);
  });
});