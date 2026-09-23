import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import ApiError from '../../../utils/errors/ApiError.js';
import { BCRYPT_ROUNDS } from '../../../utils/constants.js';
import dbPool from '../../../config/db/dbPool.js';
import withTransaction from '../../../utils/db/withTransaction.js';
import writeAudit from '../../../utils/audit/writeAudit.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import USER_PUBLIC_COLUMNS from '../resources/userResource.js';
import createUserRequest, { UNIQUE_VIOLATIONS } from '../requests/createUserRequest.js';
import updateUserRequest, { USER_FK_VIOLATIONS } from '../requests/updateUserRequest.js';

/**
* ---------------------------------------------------
* GET /api/v1/users
* ---------------------------------------------------
*/
const getUsers = asyncHandler(async (req, res) => {
  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query('SELECT COUNT(*)::int AS total FROM users WHERE deleted_at IS NULL'),
    dbPool.query(
      `SELECT ${USER_PUBLIC_COLUMNS}
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [perPage, offset]
    ),
  ]);

  res.json(paginateResponse(req, {
    rows: dataResult.rows,
    total: countResult.rows[0].total,
    page, perPage, offset,
  }));
});

/**
* ---------------------------------------------------
* POST /api/v1/users
* ---------------------------------------------------
*/
const createUser = asyncHandler(async (req, res) => {
  const data = await createUserRequest(req?.body);

  const [passwordHash] = await Promise.all([
    bcrypt.hash(data.password, BCRYPT_ROUNDS),
  ]);

  const created = await withTransaction(async (client) => {
    let result;
    try {
      result = await client.query(
        `INSERT INTO users (
            first_name, last_name, username, email, password,
            role, country_phone_code, phone_number, email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${USER_PUBLIC_COLUMNS}`,
        [
          data.first_name,
          data.last_name,
          data.username,
          data.email,
          passwordHash,
          'user',
          data.country_phone_code ?? null,
          data.phone_number ?? null,
          true,  // admin created accounts are pre-verified
        ]
      );
    } catch (error) {
      if (error.code === '23505') {
        throw new ApiError(409, UNIQUE_VIOLATIONS[error.constraint] ?? 'Conflict');
      }
      throw error;
    }

    const user = result.rows[0];
    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'user',
      subject_id: user.id,
      action: 'created',
      payload: { username: user.username, role: user.role },
    });

    return user;
  });

  res.status(201).json({ data: created });
});

/**
* ---------------------------------------------------
* GET /api/v1/users/:id
* ---------------------------------------------------
*/
const getUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid user id');
  }

  const { rows } = await dbPool.query(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );

  if (rows.length === 0) throw new ApiError(404, 'User not found');

  res.json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* PUT/PATCH /api/v1/users/:id
* ---------------------------------------------------
*/
const updateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid user id');
  }

  const data = await updateUserRequest(req.body);

  /** An admin cannot change their own role. Prevents the "last admin demoted themselves" orphan state — someone else must do it. */
  if (req.user.id === id && 'role' in data) {
    throw new ApiError(403, 'You cannot change your own role.');
  }

  if (data.secret_question_login === true) {
    const errors = {};
    if (!data.secret_question) {
      errors.secret_question = 'secret_question is required when enabling QA login';
    }
    if (!data.secret_question_answer) {
      errors.secret_question_answer = 'secret_question_answer is required when enabling QA login';
    }
    if (Object.keys(errors).length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }
  }

  if (data.secret_question_answer) {
    data.secret_question_answer = await bcrypt.hash(
      data.secret_question_answer,
      BCRYPT_ROUNDS
    );
  }

  const fields = Object.keys(data);
  if (fields.length === 0) {
    throw new ApiError(400, 'No updatable fields provided');
  }

    /** Field names come from UPDATE_USER_SCHEMA keys via validate(), which is a whitelist. Values are parameterized. Safe by construction. */
  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map((f) => data[f]);
  values.push(id);

  const updated = await withTransaction(async (client) => {
    const before = await client.query(
      'SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (before.rows.length === 0) throw new ApiError(404, 'User not found');

    let result;
    try {
      result = await client.query(
        `UPDATE users
         SET ${setClauses.join(', ')}
         WHERE id = $${values.length} AND deleted_at IS NULL
         RETURNING ${USER_PUBLIC_COLUMNS}`,
        values
      );
    } catch (error) {
      if (error.code === '23505') {
        throw new ApiError(409, UNIQUE_VIOLATIONS[error.constraint] ?? 'Conflict');
      }
      throw error;
    }

    const user = result.rows[0];

    const roleChanged = 'role' in data && data.role !== before.rows[0].role;
    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'user',
      subject_id: user.id,
      action: roleChanged ? 'role_changed' : 'updated',
      payload: roleChanged
        ? { old_role: before.rows[0].role, new_role: data.role }
        : { changes: data },
    });

    return user;
  });

  res.json({ data: updated });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/users/:id
* ---------------------------------------------------
*/
const deleteUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid user id');
  }

  if (req.user.id === id) {
    throw new ApiError(403, 'You cannot delete your own account.');
  }

  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE users
       SET deleted_at = CURRENT_TIMESTAMP,
           password_changed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'user',
      subject_id: id,
      action: 'deleted',
    });
  });

  res.json({ message: 'User deleted' });
});

export {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
};