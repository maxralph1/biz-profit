import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseId from '../../../utils/http/parseId.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import TRANSACTION_TYPE_PUBLIC_COLUMNS from '../resources/transactionTypeResource.js';
import createTransactionTypeRequest from '../requests/createTransactionTypeRequest.js';
import updateTransactionTypeRequest from '../requests/updateTransactionTypeRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';

const UNIQUE_NAME_CONSTRAINT = 'uq_transaction_type_business_name';
const DUPLICATE_NAME_MSG = 'A transaction type with that name already exists for this business';

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transaction-types
* ---------------------------------------------------
*/
const getTransactionTypes = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadVisibleBusiness(businessId, req.user);

  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      'SELECT COUNT(*)::int AS total FROM transaction_types WHERE business_id = $1',
      [businessId]
    ),
    dbPool.query(
      `SELECT ${TRANSACTION_TYPE_PUBLIC_COLUMNS}
       FROM transaction_types
       WHERE business_id = $1
       ORDER BY id ASC
       LIMIT $2 OFFSET $3`,
      [businessId, perPage, offset]
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
* POST /api/v1/businesses/:businessId/transaction-types
* ---------------------------------------------------
*/
const createTransactionType = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadManageableBusiness(businessId, req.user);

  const data = createTransactionTypeRequest(req.body);

  let result;
  try {
    result = await dbPool.query(
      `INSERT INTO transaction_types (business_id, user_id, name, description, type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${TRANSACTION_TYPE_PUBLIC_COLUMNS}`,
      [businessId, req.user.id, data.name, data.description, data.type]
    );
  } catch (error) {
    if (error.code === '23505' && error.constraint === UNIQUE_NAME_CONSTRAINT) {
      throw new ApiError(409, DUPLICATE_NAME_MSG);
    }
    throw error;
  }

  res.status(201).json({ data: result.rows[0] });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transaction-types/:id
* ---------------------------------------------------
*/
const getTransactionType = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction type id');

  await loadVisibleBusiness(businessId, req.user);

  const { rows } = await dbPool.query(
    `SELECT ${TRANSACTION_TYPE_PUBLIC_COLUMNS}
     FROM transaction_types
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Transaction type not found');
  }

  res.json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/transaction-types/:id
* ---------------------------------------------------
*/
const updateTransactionType = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction type id');

  await loadManageableBusiness(businessId, req.user);

  const data = updateTransactionTypeRequest(req.body);

  const fields = Object.keys(data);
  if (fields.length === 0) {
    throw new ApiError(400, 'No updatable fields provided');
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map((f) => data[f]);
  values.push(id, businessId);

  let result;
  try {
    result = await dbPool.query(
      `UPDATE transaction_types
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND business_id = $${values.length}
       RETURNING ${TRANSACTION_TYPE_PUBLIC_COLUMNS}`,
      values
    );
  } catch (error) {
    if (error.code === '23505' && error.constraint === UNIQUE_NAME_CONSTRAINT) {
      throw new ApiError(409, DUPLICATE_NAME_MSG);
    }
    throw error;
  }

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Transaction type not found');
  }

  res.json({ data: result.rows[0] });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/transaction-types/:id
* ---------------------------------------------------
*/
const deleteTransactionType = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction type id');

  await loadManageableBusiness(businessId, req.user);

  let result;
  try {
    result = await dbPool.query(
      'DELETE FROM transaction_types WHERE id = $1 AND business_id = $2 RETURNING id',
      [id, businessId]
    );
  } catch (error) {
    if (error.code === '23503' || error.code === '23001') {
      throw new ApiError(
        409,
        'Cannot delete transaction type: it is referenced by existing transactions'
      );
    }
    throw error;
  }

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Transaction type not found');
  }

  res.json({ message: 'Transaction type deleted' });
});

export {
  getTransactionTypes,
  createTransactionType,
  getTransactionType,
  updateTransactionType,
  deleteTransactionType,
};