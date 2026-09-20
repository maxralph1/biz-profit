import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import parseId from '../../../utils/http/parseId.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import MONTHLY_TOTAL_PUBLIC_COLUMNS from '../resources/monthlyTotalResource.js';
import createMonthlyTotalRequest from '../requests/createMonthlyTotalRequest.js';
import updateMonthlyTotalRequest from '../requests/updateMonthlyTotalRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';

const UNIQUE_CONSTRAINT = 'uq_monthly_total';
const DUPLICATE_MSG =
  'A monthly total for that business, month, and currency already exists.';

const IMMUTABILITY_MSG =
  'Approved monthly totals cannot be edited. Delete and recreate to correct.';

/**
 * Loads a monthly total scoped to the business, or throws 404.
 */
async function loadMonthlyTotalOr404(businessId, id) {
  const { rows } = await dbPool.query(
    'SELECT id, approved FROM monthly_totals WHERE id = $1 AND business_id = $2',
    [id, businessId]
  );
  if (rows.length === 0) throw new ApiError(404, 'Monthly total not found');
  return rows[0];
}

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/monthly-totals
* ---------------------------------------------------
*/
const getMonthlyTotals = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadVisibleBusiness(businessId, req.user);

  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      'SELECT COUNT(*)::int AS total FROM monthly_totals WHERE business_id = $1',
      [businessId]
    ),
    dbPool.query(
      `SELECT ${MONTHLY_TOTAL_PUBLIC_COLUMNS}
       FROM monthly_totals
       WHERE business_id = $1
       ORDER BY month_in_review DESC, id DESC
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
* POST /api/v1/businesses/:businessId/monthly-totals
* ---------------------------------------------------
*/
const createMonthlyTotal = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');

  await loadManageableBusiness(businessId, req.user);

  const data = createMonthlyTotalRequest(req.body);

  let result;
  try {
    result = await dbPool.query(
      `INSERT INTO monthly_totals (
         business_id, created_by, narration, amount, currency,
         approved, approver_id, month_in_review
       ) VALUES (
         $1, $2, $3, $4, $5,
         FALSE, NULL, $6
       )
       RETURNING ${MONTHLY_TOTAL_PUBLIC_COLUMNS}`,
      [
        businessId,
        req.user.id,
        data.narration,
        data.amount,
        data.currency,
        data.month_in_review,
      ]
    );
  } catch (error) {
    if (error.code === '23505' && error.constraint === UNIQUE_CONSTRAINT) {
      throw new ApiError(409, DUPLICATE_MSG);
    }
    throw error;
  }

  res.status(201).json({ data: result.rows[0] });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/monthly-totals/:id
* ---------------------------------------------------
*/
const getMonthlyTotal = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'monthly total id');

  await loadVisibleBusiness(businessId, req.user);

  const { rows } = await dbPool.query(
    `SELECT ${MONTHLY_TOTAL_PUBLIC_COLUMNS}
     FROM monthly_totals
     WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );

  if (rows.length === 0) throw new ApiError(404, 'Monthly total not found');

  res.json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/monthly-totals/:id
* ---------------------------------------------------
*/
const updateMonthlyTotal = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'monthly total id');

  await loadManageableBusiness(businessId, req.user);

  const existing = await loadMonthlyTotalOr404(businessId, id);
  if (existing.approved) {
    throw new ApiError(409, IMMUTABILITY_MSG);
  }

  const data = updateMonthlyTotalRequest(req.body);

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
      `UPDATE monthly_totals
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND business_id = $${values.length}
       RETURNING ${MONTHLY_TOTAL_PUBLIC_COLUMNS}`,
      values
    );
  } catch (error) {
    if (error.code === '23505' && error.constraint === UNIQUE_CONSTRAINT) {
      throw new ApiError(409, DUPLICATE_MSG);
    }
    throw error;
  }

  if (result.rows.length === 0) throw new ApiError(404, 'Monthly total not found');

  res.json({ data: result.rows[0] });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/monthly-totals/:id
* ---------------------------------------------------
*/
const deleteMonthlyTotal = asyncHandler(async (req, res) => {
  const businessId = parseId(req.params.businessId, 'business id');
  const id = parseId(req.params.id, 'monthly total id');

  await loadManageableBusiness(businessId, req.user);

  await loadMonthlyTotalOr404(businessId, id);
  /** No immutability check here. Approved monthly totals must be deletable — otherwise the uq_monthly_total constraint traps an incorrect snapshot forever. Deleting and recreating is the correction mechanism. */

  await dbPool.query(
    'DELETE FROM monthly_totals WHERE id = $1 AND business_id = $2',
    [id, businessId]
  );

  res.json({ message: 'Monthly total deleted' });
});

export {
  getMonthlyTotals,
  createMonthlyTotal,
  getMonthlyTotal,
  updateMonthlyTotal,
  deleteMonthlyTotal,
};