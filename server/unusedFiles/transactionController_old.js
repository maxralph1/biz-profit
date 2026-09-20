import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseId from '../../../utils/http/parseId.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import TRANSACTION_PUBLIC_COLUMNS from '../resources/transactionResource.js';
import createTransactionRequest from '../requests/createTransactionRequest.js';
import updateTransactionRequest from '../requests/updateTransactionRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';

// ---------------------------------------------------------------------------
// GET /businesses/:businessId/transactions
// ---------------------------------------------------------------------------
const getTransactions = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadVisibleBusiness(businessId, req.user);

  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      'SELECT COUNT(*)::int AS total FROM transactions WHERE business_id = $1',
      [businessId]
    ),
    dbPool.query(
      `SELECT ${TRANSACTION_PUBLIC_COLUMNS}
       FROM transactions
       WHERE business_id = $1
       ORDER BY transaction_date DESC, id DESC
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

// ---------------------------------------------------------------------------
// POST /businesses/:businessId/transactions
// ---------------------------------------------------------------------------
const createTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadManageableBusiness(businessId, req.user);

  const data = createTransactionRequest(req.body);

  // transaction_type_id must belong to this business — a client shouldn't be
  // able to reference another business's transaction type.
  const { rows: ttRows } = await dbPool.query(
    'SELECT id FROM transaction_types WHERE id = $1 AND business_id = $2',
    [data.transaction_type_id, businessId]
  );
  if (ttRows.length === 0) {
    throw new ApiError(422, 'Validation failed', {
      transaction_type_id: 'transaction_type_id does not belong to this business',
    });
  }

  let result;
  try {
    result = await dbPool.query(
      `INSERT INTO transactions (
         transaction_type_id, business_id, created_by, narration,
         amount, currency, approved, approver_id, transaction_date
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8, COALESCE($9::timestamptz, CURRENT_TIMESTAMP)
       )
       RETURNING ${TRANSACTION_PUBLIC_COLUMNS}`,
      [
        data.transaction_type_id,
        businessId,
        req.user.id,
        data.narration,
        data.amount,
        data.currency,
        false,   // new transactions are always unapproved
        null,    // and therefore have no approver
        data.transaction_date ?? null,
      ]
    );
  } catch (error) {
    if (error.code === '23514') {
      // chk_transaction_approval_consistency violated — shouldn't happen given
      // the values above, but defensive.
      throw new ApiError(400, 'Invalid approval state');
    }
    throw error;
  }

  res.status(201).json({ data: result.rows[0] });
});

// ---------------------------------------------------------------------------
// GET /businesses/:businessId/transactions/:id
// ---------------------------------------------------------------------------
const getTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadVisibleBusiness(businessId, req.user);

  const { rows } = await dbPool.query(
    `SELECT ${TRANSACTION_PUBLIC_COLUMNS}
     FROM transactions
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Transaction not found');
  }

  res.json({ data: rows[0] });
});

// ---------------------------------------------------------------------------
// PATCH /businesses/:businessId/transactions/:id
// ---------------------------------------------------------------------------
const updateTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const data = updateTransactionRequest(req.body);

  if (data.transaction_type_id) {
    const { rows } = await dbPool.query(
      'SELECT id FROM transaction_types WHERE id = $1 AND business_id = $2',
      [data.transaction_type_id, businessId]
    );
    if (rows.length === 0) {
      throw new ApiError(422, 'Validation failed', {
        transaction_type_id: 'transaction_type_id does not belong to this business',
      });
    }
  }

  // `approved` drives `approver_id`. The two are the same "fact" from the
  // client's perspective; the DB CHECK enforces they stay consistent.
  if ('approved' in data) {
    if (data.approved === true) {
      data.approver_id = req.user.id;
    } else {
      data.approver_id = null;
    }
  }

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
      `UPDATE transactions
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND business_id = $${values.length}
       RETURNING ${TRANSACTION_PUBLIC_COLUMNS}`,
      values
    );
  } catch (error) {
    if (error.code === '23514') {
      throw new ApiError(400, 'Invalid approval state');
    }
    throw error;
  }

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Transaction not found');
  }

  res.json({ data: result.rows[0] });
});

// ---------------------------------------------------------------------------
// DELETE /businesses/:businessId/transactions/:id
// ---------------------------------------------------------------------------
const deleteTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const result = await dbPool.query(
    'DELETE FROM transactions WHERE id = $1 AND business_id = $2 RETURNING id',
    [id, businessId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Transaction not found');
  }

  res.json({ message: 'Transaction deleted' });
});

export {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
};