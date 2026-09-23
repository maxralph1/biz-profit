import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseId from '../../../utils/http/parseId.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import AUDIT_EVENT_PUBLIC_COLUMNS from '../resources/auditEventResource.js';
import { loadVisibleBusiness } from '../../../utils/business/access.js';

const VALID_SUBJECT_TYPES = new Set([
  'user', 'business', 'business_user',
  'transaction_type', 'transaction', 'monthly_total',
]);

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/audit-events   - Optional filters: subject_type, subject_id, actor_id, action
* ---------------------------------------------------
*/
const getBusinessAuditEvents = asyncHandler(async (req, res) => {
  // console.log('[audit] req.params:', JSON.stringify(req.params));
  
  const businessId = parseId(req.params.businessId, 'business id');

  await loadVisibleBusiness(businessId, req.user);

  const { page, perPage, offset } = resolvePagination(req);

  const conditions = ['business_id = $1'];
  const values = [businessId];

  const { subject_type, subject_id, actor_id, action } = req.query;

  if (subject_type) {
    if (!VALID_SUBJECT_TYPES.has(subject_type)) {
      throw new ApiError(400, 'Invalid subject_type filter');
    }
    values.push(subject_type);
    conditions.push(`subject_type = $${values.length}`);
  }
  if (subject_id) {
    const sid = Number(subject_id);
    if (!Number.isInteger(sid) || sid < 1) {
      throw new ApiError(400, 'Invalid subject_id filter');
    }
    values.push(sid);
    conditions.push(`subject_id = $${values.length}`);
  }
  if (actor_id) {
    const aid = Number(actor_id);
    if (!Number.isInteger(aid) || aid < 1) {
      throw new ApiError(400, 'Invalid actor_id filter');
    }
    values.push(aid);
    conditions.push(`actor_id = $${values.length}`);
  }
  if (action) {
    if (typeof action !== 'string' || action.length === 0 || action.length > 50) {
      throw new ApiError(400, 'Invalid action filter');
    }
    values.push(action);
    conditions.push(`action = $${values.length}`);
  }

  const where = conditions.join(' AND ');

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      `SELECT COUNT(*)::int AS total FROM audit_events WHERE ${where}`,
      values
    ),
    dbPool.query(
      `SELECT ${AUDIT_EVENT_PUBLIC_COLUMNS}
       FROM audit_events
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, perPage, offset]
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
* GET /api/v1/businesses/:businessId/transactions/:id/events - Convenience wrapper for the transaction-scoped view
* ---------------------------------------------------
*/
const getTransactionAuditEvents = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'transaction id');

  await loadVisibleBusiness(businessId, req.user);

  /** The transaction must exist and not be soft-deleted to show its events. */
  const { rows: txRows } = await dbPool.query(
    `SELECT id FROM transactions
     WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
    [id, businessId]
  );
  if (txRows.length === 0) throw new ApiError(404, 'Transaction not found');

  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      `SELECT COUNT(*)::int AS total FROM audit_events
       WHERE subject_type = 'transaction' AND subject_id = $1`,
      [id]
    ),
    dbPool.query(
      `SELECT ${AUDIT_EVENT_PUBLIC_COLUMNS}
       FROM audit_events
       WHERE subject_type = 'transaction' AND subject_id = $1
       ORDER BY created_at ASC, id ASC
       LIMIT $2 OFFSET $3`,
      [id, perPage, offset]
    ),
  ]);

  res.json(paginateResponse(req, {
    rows: dataResult.rows,
    total: countResult.rows[0].total,
    page, perPage, offset,
  }));
});

export { getBusinessAuditEvents, getTransactionAuditEvents };