import asyncHandler from 'express-async-handler'; 
import bcrypt from 'bcryptjs'; 
import ApiError from '../../../utils/errors/ApiError.js';
import { BCRYPT_ROUNDS } from '../../../utils/constants.js';
import dbPool from '../../../config/db/dbPool.js'; 
// import buildUrl from '../../../utils/pagination/buildUrl.js'; 
// import buildPageLinks from '../../../utils/pagination/buildPageLinks.js'; 
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js'; 
import USER_PUBLIC_COLUMNS from '../resources/userResource.js'; 
import createUserRequest, { UNIQUE_VIOLATIONS } from '../requests/createUserRequest.js'; 
import updateUserRequest, { USER_FK_VIOLATIONS } from '../requests/updateUserRequest.js'; 

/**
* ---------------------------------------------------
* GET /api/v1/users
* ---------------------------------------------------
*/
const getUsers = asyncHandler(async (req, res) => {
  /**
  const { rows } = await dbPool.query('SELECT * FROM users');
  res.json({ data: rows });
  **/ 

  const { page, perPage, offset } = resolvePagination(req); 

  const [countResult, dataResult] = await Promise.all([
    dbPool.query('SELECT COUNT(*)::int AS total FROM users'), 
    dbPool.query(
      `SELECT ${USER_PUBLIC_COLUMNS} 
      FROM users 
      ORDER BY id ASC 
      LIMIT $1 OFFSET $2`, 
      [perPage, offset]
    )
  ]); 

  /**
  const total = countResult.rows[0].total; 
  const lastPage = Math.max(1, Math.ceil(total / perPage)); 
  const rows = dataResult.rows; 
  const path = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`; 

  res.json({
    current_page: page, 
    data: rows, 
    first_page_url: buildUrl(req, 1), 
    from: rows.length ? offset + 1 : null, 
    last_page: lastPage, 
    last_page_url: buildUrl(req, lastPage), 
    links: buildPageLinks(req, page, lastPage), 
    next_page_url: page < lastPage ? buildUrl(req, page + 1) : null, 
    path, 
    per_page: perPage, 
    prev_page_url: page > 1 ? buildUrl(req, page - 1) : null, 
    to: rows.length ? offset + rows.length : null, 
    total
  });
  */
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

  // const [passwordHash, answerHash] = await Promise.all([
  const [passwordHash] = await Promise.all([
    // bcrypt.hash(data.secret_question_answer, BCRYPT_ROUNDS),
    bcrypt.hash(data.password, BCRYPT_ROUNDS), 
  ]); 

  let result; 

  try {
    result = await dbPool.query(
      `INSERT INTO users (
          first_name, last_name, username, email, password, role, country_phone_code, phone_number, email_verified 
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) 
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
        true   // admin created accounts are pre-verified
      ]
    );
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError(409, UNIQUE_VIOLATIONS[error.constraint] ?? 'Conflict');
    }
    throw error;
  } 

  res.status(201).json({ data: result.rows[0] });
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
     WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'User not found');
  }

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

  const data = await updateUserRequest(req?.body);

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
  const values = fields.map(f => data[f]);
  values.push(id);

  const sql = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $${values.length}
    RETURNING ${USER_PUBLIC_COLUMNS}
  `;

  let result;
  try {
    result = await dbPool.query(sql, values);
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError(409, UNIQUE_VIOLATIONS[error.constraint] ?? 'Conflict');
    }
    throw error;
  }

  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found');
  }

  res.json({ data: result.rows[0] });
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

  let result;
  try {
    result = await dbPool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
  } catch (error) {
    if (error.code === '23503' || error.code === '23001') {
      throw new ApiError(
        409,
        USER_FK_VIOLATIONS[error.constraint] ??
          'Cannot delete user: they are referenced by existing records.'
      );
    }
    throw error;
  }

  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found');
  }

  // res.json({ message: 'User deleted' });
  res.status(204).end();
});

export {
  getUsers, 
  createUser, 
  getUser, 
  updateUser, 
  deleteUser
};