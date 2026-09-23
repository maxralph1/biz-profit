import asyncHandler from 'express-async-handler';
import dbClient from '../../../config/db/dbClient.js';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseId from '../../../utils/http/parseId.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import TRANSACTION_TYPE_PUBLIC_COLUMNS from '../resources/transactionTypeResource.js';
import createTransactionTypeRequest from '../requests/createTransactionTypeRequest.js';
import updateTransactionTypeRequest from '../requests/updateTransactionTypeRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';
import withTransaction from '../../../utils/db/withTransaction.js';
import writeAudit from '../../../utils/audit/writeAudit.js';

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
      'SELECT COUNT(*)::int AS total FROM transaction_types WHERE business_id = $1 AND deleted_at IS NULL',
      [businessId]
    ),
    dbPool.query(
      `SELECT ${TRANSACTION_TYPE_PUBLIC_COLUMNS}
       FROM transaction_types
       WHERE business_id = $1 AND deleted_at IS NULL 
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

  /**
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
  */

  const created = await withTransaction(async (dbClient) => {
    let result;
    try {
      result = await dbClient.query(
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

    const tt = result.rows[0];

    await writeAudit(dbClient, {
      actor_id: req.user.id,
      subject_type: 'transaction_type',
      subject_id: tt.id,
      business_id: businessId,
      action: 'created',
      payload: { name: tt.name, type: tt.type },
    });

    return tt;
  });

  res.status(201).json({ data: created });
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
     WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
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

  /**
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
  */

  const updated = await withTransaction(async (dbClient) => {
    let result;
    try {
      result = await dbClient.query(
        `UPDATE transaction_types
         SET ${setClauses.join(', ')}
         WHERE id = $${values.length - 1}
           AND business_id = $${values.length}
           AND deleted_at IS NULL
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
    const tt = result.rows[0];

    await writeAudit(dbClient, {
      actor_id: req.user.id,
      subject_type: 'transaction_type',
      subject_id: tt.id,
      business_id: businessId,
      action: 'updated',
      payload: { changes: data },
    });

    return tt;
  });

  res.json({ data: updated });
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

  /**
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
  */

  await withTransaction(async (dbClient) => {
    const result = await dbClient.query(
      `UPDATE transaction_types
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, businessId]
    );
    if (result.rows.length === 0) {
      throw new ApiError(404, 'Transaction type not found');
    }

    await writeAudit(dbClient, {
      actor_id: req.user.id,
      subject_type: 'transaction_type',
      subject_id: id,
      business_id: businessId,
      action: 'deleted',
    });
  });

  res.json({ message: 'Transaction type deleted' });
});

export {
  getTransactionTypes,
  createTransactionType,
  getTransactionType,
  updateTransactionType,
  deleteTransactionType,
};