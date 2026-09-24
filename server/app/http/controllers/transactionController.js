import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseUuid from '../../../utils/http/parseUuid.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import withTransaction from '../../../utils/db/withTransaction.js';
import writeAudit from '../../../utils/audit/writeAudit.js';
import {
  TRANSACTION_PUBLIC_COLUMNS,
  TRANSACTION_SELECT_COLUMNS,
} from '../resources/transactionResource.js';
import createTransactionRequest from '../requests/createTransactionRequest.js';
import updateTransactionRequest from '../requests/updateTransactionRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';

const IMMUTABILITY_MSG =
  'Approved transactions cannot be modified or deleted. Reverse it to make corrections.';

async function loadTransactionOr404(businessId, id, client = dbPool) {
  const { rows } = await client.query(
    `SELECT id, approved, reverses_transaction_id
     FROM transactions
     WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
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
  const businessId = parseUuid(req.params.businessId, 'business id');

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
  const businessId = parseUuid(req.params.businessId, 'business id');

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

  const created = await withTransaction(async (client) => {
    const result = await client.query(
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
    const tx = result.rows[0];

    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'transaction',
      subject_id: tx.id,
      business_id: businessId,
      action: 'created',
      payload: {
        transaction_type_id: tx.transaction_type_id,
        amount: String(tx.amount),
        currency: tx.currency,
        narration: tx.narration,
      },
    });

    return tx;
  });

  res.status(201).json({ data: { ...created, is_reversed: false } });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/transactions/:id
* ---------------------------------------------------
*/
const getTransaction = asyncHandler(async (req, res) => {
  const businessId = parseUuid(req.params.businessId, 'business id');
  const id = parseUuid(req.params.id, 'transaction id');

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
  const businessId = parseUuid(req.params.businessId, 'business id');
  const id = parseUuid(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const existing = await loadTransactionOr404(businessId, id);
  if (existing.approved) throw new ApiError(409, IMMUTABILITY_MSG);

  const data = updateTransactionRequest(req.body);

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

  /** Snapshot what the client requested BEFORE we derive approver_id. */
  const changes = { ...data };

  if ('approved' in data) {
    data.approver_id = data.approved === true ? req.user.id : null;
  }

  const fields = Object.keys(data);
  if (fields.length === 0) throw new ApiError(400, 'No updatable fields provided');

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map((f) => data[f]);
  values.push(id, businessId);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE transactions
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1}
         AND business_id = $${values.length}
         AND deleted_at IS NULL
       RETURNING ${TRANSACTION_PUBLIC_COLUMNS}`,
      values
    );
    if (result.rows.length === 0) throw new ApiError(404, 'Transaction not found');
    const tx = result.rows[0];

    /** Approval transition is its own action; everything else is 'updated'. */
    const onlyApproval =
      Object.keys(changes).length === 1 && 'approved' in changes;
    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'transaction',
      subject_id: tx.id,
      business_id: businessId,
      action: onlyApproval && changes.approved ? 'approved' : 'updated',
      payload: onlyApproval && changes.approved ? null : { changes },
    });

    return tx;
  });

  res.json({ data: { ...updated, is_reversed: false } });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/transactions/:id
* ---------------------------------------------------
*/
const deleteTransaction = asyncHandler(async (req, res) => {
  const businessId = parseUuid(req.params.businessId, 'business id');
  const id = parseUuid(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const existing = await loadTransactionOr404(businessId, id);
  if (existing.approved) throw new ApiError(409, IMMUTABILITY_MSG);

  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE transactions
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, businessId]
    );
    if (result.rows.length === 0) throw new ApiError(404, 'Transaction not found');

    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'transaction',
      subject_id: id,
      business_id: businessId,
      action: 'deleted',
    });
  });

  res.json({ message: 'Transaction deleted' });
});

/**
* ---------------------------------------------------
* POST /api/v1/businesses/:businessId/transactions/:id/reverse
* ---------------------------------------------------
*/
const reverseTransaction = asyncHandler(async (req, res) => {
  const businessId = parseUuid(req.params.businessId, 'business id');
  const id = parseUuid(req.params.id, 'transaction id');

  await loadManageableBusiness(businessId, req.user);

  const { rows: origRows } = await dbPool.query(
    `SELECT id, transaction_type_id, narration, amount, currency,
            approved, reverses_transaction_id
     FROM transactions
     WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
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
  const reversedAmount = -Number(orig.amount);

  const created = await withTransaction(async (client) => {
    let result;
    try {
      result = await client.query(
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
    const tx = result.rows[0];

    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'transaction',
      subject_id: tx.id,
      business_id: businessId,
      action: 'created',
      payload: {
        transaction_type_id: tx.transaction_type_id,
        amount: String(tx.amount),
        currency: tx.currency,
        narration: tx.narration,
        reverses_transaction_id: tx.reverses_transaction_id,
      },
    });

    await writeAudit(client, {
      actor_id: req.user.id,
      subject_type: 'transaction',
      subject_id: orig.id,
      business_id: businessId,
      action: 'reversed',
      payload: { reversal_id: tx.id },
    });

    return tx;
  });

  res.status(201).json({ data: { ...created, is_reversed: false } });
});

export {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  reverseTransaction,
};