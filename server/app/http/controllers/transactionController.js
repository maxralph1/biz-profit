import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseId from '../../../utils/http/parseId.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import { TRANSACTION_PUBLIC_COLUMNS, TRANSACTION_SELECT_COLUMNS } from '../resources/transactionResource.js';
import createTransactionRequest from '../requests/createTransactionRequest.js';
import updateTransactionRequest from '../requests/updateTransactionRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';

const IMMUTABILITY_MSG =
  'Approved transactions cannot be modified or deleted. Reverse it to make corrections.';

/**
 * Loads a transaction scoped to the business, or throws 404. Also returns
 * the `approved` flag so callers can enforce immutability.
 */
async function loadTransactionOr404(businessId, id) {
  const { rows } = await dbPool.query(
    `SELECT id, approved, reverses_transaction_id
     FROM transactions
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  if (rows.length === 0) throw new ApiError(404, 'Transaction not found');
  return rows[0];
}

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transactions
* ---------------------------------------------------
*/
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
      `SELECT ${TRANSACTION_SELECT_COLUMNS}
       FROM transactions t
       WHERE t.business_id = $1
       ORDER BY t.transaction_date DESC, t.id DESC
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
* POST /api/v1/businesses/:businessId/transactions
* ---------------------------------------------------
*/
const createTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadManageableBusiness(businessId, req.user);

  const data = createTransactionRequest(req.body);

  const { rows: ttRows } = await dbPool.query(
    'SELECT id FROM transaction_types WHERE id = $1 AND business_id = $2',
    [data.transaction_type_id, businessId]
  );
  if (ttRows.length === 0) {
    throw new ApiError(422, 'Validation failed', {
      transaction_type_id: 'transaction_type_id does not belong to this business',
    });
  }

  const result = await dbPool.query(
    `INSERT INTO transactions (
       transaction_type_id, business_id, created_by, narration,
       amount, currency, approved, approver_id, transaction_date
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, FALSE, NULL, COALESCE($7::timestamptz, CURRENT_TIMESTAMP)
     )
     RETURNING ${TRANSACTION_PUBLIC_COLUMNS}`,
    [
      data.transaction_type_id,
      businessId,
      req.user.id,
      data.narration,
      data.amount,
      data.currency,
      data.transaction_date ?? null,
    ]
  );

  /** A freshly created row cannot yet have been reversed. */
  res.status(201).json({ data: { ...result.rows[0], is_reversed: false } });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transactions/:id
* ---------------------------------------------------
*/
const getTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadVisibleBusiness(businessId, req.user);

  const { rows } = await dbPool.query(
    `SELECT ${TRANSACTION_SELECT_COLUMNS}
     FROM transactions t
     WHERE t.id = $1 AND t.business_id = $2`,
    [id, businessId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Transaction not found');
  }

  res.json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/transactions/:id
* ---------------------------------------------------
*/
const updateTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const existing = await loadTransactionOr404(businessId, id);
  if (existing.approved) {
    throw new ApiError(409, IMMUTABILITY_MSG);
  }

  const data = updateTransactionRequest(req.body);

  /**
  if (existing.reverses_transaction_id !== null) {
    throw new ApiError(409, 'A reversal entry cannot be modified.');
  }
  */
  if (existing.reverses_transaction_id !== null) {
    const disallowed = Object.keys(data).filter(
      (k) => k !== 'narration' && k !== 'approved'
    );
    if (disallowed.length > 0) {
      throw new ApiError(
        409,
        'A reversal entry only allows narration and approval changes.'
      );
    }
  }

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

  /** `approved` transition drives `approver_id`. Only fires on unapproved transactions (the guard above already rejected the approved case). */
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

  const result = await dbPool.query(
    `UPDATE transactions
     SET ${setClauses.join(', ')}
     WHERE id = $${values.length - 1} AND business_id = $${values.length}
     RETURNING ${TRANSACTION_PUBLIC_COLUMNS}`,
    values
  );

  const row = result.rows[0];
  /**
  Whether it's now reversed: unknown after update, but a row with reverses_transaction_id set is itself a reversal (never reversed).
  A non-reversal row could have been reversed by someone else, which the immutability guard above permits only for unapproved rows, and unapproved rows cannot have been reversed (reversals target approved rows only). 
  */
  res.json({ data: { ...row, is_reversed: false } });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/transactions/:id
* ---------------------------------------------------
*/
const deleteTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const existing = await loadTransactionOr404(businessId, id);
  if (existing.approved) {
    throw new ApiError(409, IMMUTABILITY_MSG);
  }

  await dbPool.query(
    'DELETE FROM transactions WHERE id = $1 AND business_id = $2',
    [id, businessId]
  );

  res.json({ message: 'Transaction deleted' });
});

/**
* ---------------------------------------------------
* POST /api/v1/businesses/:businessId/transactions/:id/reverse
* ---------------------------------------------------
*/
const reverseTransaction = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const { rows: origRows } = await dbPool.query(
    `SELECT id, transaction_type_id, narration, amount, currency,
            approved, reverses_transaction_id
     FROM transactions
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  if (origRows.length === 0) throw new ApiError(404, 'Transaction not found');

  const orig = origRows[0];

  if (!orig.approved) {
    throw new ApiError(
      409,
      'Only approved transactions can be reversed. Delete unapproved transactions instead.'
    );
  }
  if (orig.reverses_transaction_id !== null) {
    throw new ApiError(409, 'A reversal entry cannot itself be reversed.');
  }

  const requestedNarration = req.body?.narration;
  const narration =
    typeof requestedNarration === 'string' && requestedNarration.trim()
      ? requestedNarration.trim()
      : `Reversal of transaction #${orig.id}`;

  /** amount comes back from pg as a string; unary minus coerces to a number. Then pg serializes it back to a string for the BIGINT parameter. */
  const reversedAmount = -Number(orig.amount);

  let result;
  try {
    result = await dbPool.query(
      `INSERT INTO transactions (
         transaction_type_id, business_id, created_by, narration,
         amount, currency, approved, approver_id, reverses_transaction_id
       ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL, $7)
       RETURNING ${TRANSACTION_PUBLIC_COLUMNS}`,
      [
        orig.transaction_type_id,
        businessId,
        req.user.id,
        narration,
        reversedAmount,
        orig.currency,
        orig.id,
      ]
    );
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uq_transaction_reverses') {
      throw new ApiError(409, 'This transaction has already been reversed.');
    }
    throw error;
  }

  res.status(201).json({ data: { ...result.rows[0], is_reversed: false } });
});

export {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  reverseTransaction,
};