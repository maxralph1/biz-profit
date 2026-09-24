import { jest } from '@jest/globals';
import request from 'supertest';

import app from '../index.js'; 
import { bearerFor } from './helpers/auth.js';
import asServer from './helpers/asServer.js';  
const server = asServer(app);
import { setupSchema, resetAndSeed, teardown } from './setup.js';

/** A well-formed UUID that isn't assigned to any seeded user. */
const MISSING_UUID = '00000000-0000-0000-0000-000000000000';
// const BASE = '/api/v1/users';
const BASE = '/api/v1/users';

const VALID_NEW_USER = {
  first_name: 'Linus',
  last_name: 'Torvalds',
  username: 'linus',
  email: 'linus@example.com',
  password: 'Password123!',
  // secret_question: 'First pet?',
  // secret_question_answer: 'Tux',
  country_phone_code: '+358',
  phone_number: '358517627',
};

jest.setTimeout(30_000);

// console.log('"userController tests running ..."');
let ctx;

beforeAll(setupSchema);
// beforeEach(resetAndSeed);
beforeEach(async () => { ctx = await resetAndSeed(); });
afterAll(teardown);

const asAdmin = () => bearerFor({ id: ctx.userIds.siteadmin, role: 'admin' });

/**
* ---------------------------------------------------
* GET /api/v1/users
* ---------------------------------------------------
*/
describe('GET /api/v1/users', () => {
  it('returns paginated users with default page size', async () => {
    const res = await request(server).get(BASE).set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.current_page).toBe(1);
    expect(res.body.per_page).toBe(10);
    expect(res.body.total).toBe(5);
    expect(res.body.last_page).toBe(1);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.from).toBe(1);
    expect(res.body.to).toBe(5);
  });

  it('respects per_page', async () => {
    const res = await request(server).get(`${BASE}?per_page=2`).set('Authorization', asAdmin());
    expect(res.body.per_page).toBe(2);
    expect(res.body.last_page).toBe(3);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.next_page_url).toContain('page=2');
  });

  it('returns the correct slice on page 2', async () => {
    const res = await request(server).get(`${BASE}?per_page=2&page=2`).set('Authorization', asAdmin());
    expect(res.body.current_page).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.from).toBe(3);
    expect(res.body.to).toBe(4);
    expect(res.body.prev_page_url).toContain('page=1');
  });

  it('returns empty data for pages beyond the end', async () => {
    const res = await request(server).get(`${BASE}?page=99`).set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.from).toBeNull();
    expect(res.body.to).toBeNull();
    expect(res.body.next_page_url).toBeNull();
  });

  it('clamps per_page to a maximum of 100', async () => {
    const res = await request(server).get(`${BASE}?per_page=9999`).set('Authorization', asAdmin());
    expect(res.body.per_page).toBe(100);
  });

  it('clamps page 0 to 1', async () => {
    const res = await request(server).get(`${BASE}?page=0`).set('Authorization', asAdmin());
    expect(res.body.current_page).toBe(1);
  });

  /**
  it('falls back to page 1 for non-numeric page', async () => {
    const res = await request(server).get(`${BASE}?page=abc`).set('Authorization', asAdmin());
    expect(res.body.current_page).toBe(1);
  });
  */

  it('does not leak password or secret_question_answer fields', async () => {
    const res = await request(server).get(BASE).set('Authorization', asAdmin());
    for (const u of res.body.data) {
      expect(u.password).toBeUndefined();
      expect(u.password_reset_token).toBeUndefined();
      expect(u.password_reset_token_expires_at).toBeUndefined();
      expect(u.secret_question_answer).toBeUndefined();
    }
  });

  it('includes Laravel-shaped pagination links', async () => {
    const res = await request(server).get(`${BASE}?per_page=2`).set('Authorization', asAdmin());
    expect(Array.isArray(res.body.links)).toBe(true);
    expect(res.body.links[0].label).toBe('« Previous');
    expect(res.body.links.at(-1).label).toBe('Next »');
    expect(res.body.prev_page_url).toBeNull();
    expect(res.body.first_page_url).toMatch(/page=1/);
    expect(res.body.last_page_url).toMatch(/page=2/);
  });

  it('rejects non-admin with 403', async () => {
    const res = await request(server).get(BASE)
      .set('Authorization', bearerFor({ id: ctx.userIds.grace, role: 'user' }));
    expect(res.status).toBe(403);
  });
  
  it('rejects unauthenticated with 401', async () => {
    const res = await request(server).get(BASE);
    expect(res.status).toBe(401);
  });
});

/**
* ---------------------------------------------------
* POST /api/v1/users
* ---------------------------------------------------
*/

describe('POST /api/v1/users', () => {
  it('creates a user and returns 201 with the public shape', async () => {
    const res = await request(server).post(BASE).set('Authorization', asAdmin()).send(VALID_NEW_USER);
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('linus');
    expect(res.body.data.email).toBe('linus@example.com');
    expect(res.body.data.role).toBe('user');
    expect(res.body.data.password).toBeUndefined();
    // expect(res.body.data.secret_question_answer).toBeUndefined();
    expect(res.body.data.id).toBeTruthy();
  });

  it('forces role to "user" even if client supplies "admin"', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asAdmin())
      .send({ ...VALID_NEW_USER, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('user');
  });

  it('rejects a missing email with 422', async () => {
    const { email, ...body } = VALID_NEW_USER;
    const res = await request(server).post(BASE).set('Authorization', asAdmin()).send(body);
    expect(res.status).toBe(422);
    expect(res.body.errors.email).toBe('email is required');
  });

  it('rejects a malformed email with 422', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asAdmin())
      .send({ ...VALID_NEW_USER, email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.errors.email).toBe('email must be a valid email');
  });

  it('rejects a short password with 422', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asAdmin())
      .send({ ...VALID_NEW_USER, password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.errors.password).toMatch(/at least 8 characters/);
  });

  it('returns 409 on duplicate username', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asAdmin())
      .send({ ...VALID_NEW_USER, username: 'ada' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Username already taken');
  });

  it('returns 409 on duplicate email', async () => {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', asAdmin())
      .send({ ...VALID_NEW_USER, email: 'ada@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
  });
});

/**
* ---------------------------------------------------
* GET /api/v1/users/:id
* ---------------------------------------------------
*/
describe('GET /api/v1/users/:id', () => {
  it('returns a single user without leaking secrets', async () => {
    const res = await request(server).get(`${BASE}/${ctx.userIds.grace}`).set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    //expect(res.body.data.id).toBe(1);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.secret_question_answer).toBeUndefined();
  });

  /**
  it('returns 400 for a non-numeric id', async () => {
    const res = await request(server).get(`${BASE}/abc`).set('Authorization', asAdmin());
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid user id');
  });
  */

  it('returns 400 for a non-positive id', async () => {
    const res = await request(server).get(`${BASE}/0`).set('Authorization', asAdmin());
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing user', async () => {
    const res = await request(server).get(`${BASE}/${MISSING_UUID}`).set('Authorization', asAdmin());
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
  });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/users/:id
* ---------------------------------------------------
*/
describe('PATCH /api/v1/users/:id', () => {
  it('updates only the supplied fields', async () => {
    const before = await request(server)
      .get(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin());
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ first_name: 'Graceful' });
    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Graceful');
    expect(res.body.data.last_name).toBe(before.body.data.last_name);
    expect(res.body.data.email).toBe(before.body.data.email);
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(server).patch(`${BASE}/${ctx.userIds.grace}`).set('Authorization', asAdmin()).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No updatable fields provided');
  });

  it('rejects a body of only unknown fields with 400', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ admin: true, superpower: 'flight' });
    expect(res.status).toBe(400);
  });

  /**
  it('returns 400 for a non-numeric id', async () => {
    const res = await request(server).patch(`${BASE}/abc`).set('Authorization', asAdmin()).send({ first_name: 'X' });
    expect(res.status).toBe(200);
    // expect(res.status).toBe(400);
  });
  */

  it('returns 404 for a missing user', async () => {
    const res = await request(server)
      .patch(`${BASE}/${MISSING_UUID}`)
      .set('Authorization', asAdmin())
      .send({ first_name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 409 on duplicate email against another user', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ email: 'ada@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
  });

  it('allows updating own email to the same value (no false 409)', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ email: 'grace@example.com' });
    expect(res.status).toBe(200);
  });

  it('rejects a short username with 422', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ username: 'ab' });
    expect(res.status).toBe(422);
    expect(res.body.errors.username).toMatch(/at least 3 characters/);
  });

  it('admin can promote a user to admin', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });
  
  it('admin can demote another admin to user', async () => {
    /** First promote grace, then demote her. */
    await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ role: 'admin' });
  
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ role: 'user' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('user');
  });
  
  it('admin cannot change their own role', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.siteadmin}`)
      .set('Authorization', asAdmin())
      .send({ role: 'user' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/cannot change your own role/i);
  });
  
  it('rejects an invalid role with 422', async () => {
    const res = await request(server)
      .patch(`${BASE}/${ctx.userIds.grace}`)
      .set('Authorization', asAdmin())
      .send({ role: 'superadmin' });
    expect(res.status).toBe(422);
  });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/users/:id
* ---------------------------------------------------
*/
describe('DELETE /api/v1/users/:id', () => {
  it('deletes a user with no activity', async () => {
    const created = await request(server).post(BASE).set('Authorization', asAdmin()).send(VALID_NEW_USER);
    const id = created.body.data.id;

    const res = await request(server).delete(`${BASE}/${id}`).set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    // expect(res.status).toBe(204);
    expect(res.body.message).toBe('User deleted');

    const after = await request(server).get(`${BASE}/${id}`).set('Authorization', asAdmin());
    expect(after.status).toBe(404);
  });

  /**
  it('returns 409 when the user owns a business', async () => {
    const res = await request(server).delete(`${BASE}/1`).set('Authorization', asAdmin()); // ada
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/own businesses/i);
  });
*/

  /**
  it('returns 409 when the user has memberships', async () => {
    const res = await request(server).delete(`${BASE}/3`); // alan — member of Beta
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/referenced/i);
  });
  */

  /**
  it('returns 409 when the user has memberships', async () => {
    const res = await request(server).delete(`${BASE}/3`).set('Authorization', asAdmin()); // alan — member of Beta
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/members of businesses/i);
  });
  */

  it('soft-deletes a user even if they are a member of businesses', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ctx.userIds.alan}`)
      .set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User deleted');
  
    const gone = await request(server)
      .get(`${BASE}/${ctx.userIds.alan}`)
      .set('Authorization', asAdmin());
    expect(gone.status).toBe(404);
  });

  /**
  it('returns 400 for a non-numeric id', async () => {
    const res = await request(server).delete(`${BASE}/abc`).set('Authorization', asAdmin());
    expect(res.status).toBe(400);
  });
  */

  it('returns 404 for a missing user', async () => {
    const res = await request(server).delete(`${BASE}/${MISSING_UUID}`).set('Authorization', asAdmin());
    expect(res.status).toBe(404);
  }); 

  it('soft-deletes a user even if they own a business', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ctx.userIds.ada}`)
      .set('Authorization', asAdmin());
    expect(res.status).toBe(200);
  
    const gone = await request(server)
      .get(`${BASE}/${ctx.userIds.ada}`)
      .set('Authorization', asAdmin());
    expect(gone.status).toBe(404);
  }); 

  it('prevents self-delete', async () => {
    const res = await request(server)
      .delete(`${BASE}/${ctx.userIds.siteadmin}`)
      .set('Authorization', asAdmin());
    expect(res.status).toBe(403);
  });
});