import asyncHandler from 'express-async-handler';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import BUSINESS_USER_PUBLIC_COLUMNS from '../resources/businessUserResource.js';
import createBusinessMemberRequest from '../requests/createBusinessMemberRequest.js';
import updateBusinessMemberRequest from '../requests/updateBusinessMemberRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';
import parseId from '../../../utils/http/parseId.js';

/**
function parsePositiveInt(raw, label) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return n;
}
*/

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:businessId/members
* ---------------------------------------------------
*/
const getBusinessMembers = asyncHandler(async (req, res) => {
  // const businessId = parsePositiveInt(req.params.businessId, 'business id');
  const businessId = parseId(req.params.businessId, 'business id');

  /** Listing is a read — any connected member (or site admin) can do it. */
  await loadVisibleBusiness(businessId, req.user);

  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      'SELECT COUNT(*)::int AS total FROM business_users WHERE business_id = $1',
      [businessId]
    ),
    dbPool.query(
      `SELECT ${BUSINESS_USER_PUBLIC_COLUMNS}
       FROM business_users bu
       JOIN users u ON u.id = bu.user_id
       WHERE bu.business_id = $1
       ORDER BY bu.id ASC
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
* POST /api/v1/businesses/:businessId/members
* ---------------------------------------------------
*/
const addBusinessMember = asyncHandler(async (req, res) => {
  // const businessId = parsePositiveInt(req.params.businessId, 'business id');
  const businessId = parseId(req.params.businessId, 'business id');

  await loadManageableBusiness(businessId, req.user);

  const data = createBusinessMemberRequest(req.body);

  let insertedId;
  try {
    const result = await dbPool.query(
      `INSERT INTO business_users (business_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [businessId, data.user_id, data.role]
    );
    insertedId = result.rows[0].id;
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uq_business_user') {
      throw new ApiError(409, 'User is already a member of this business');
    }
    if (error.code === '23503' && error.constraint === 'fk_business_user_user') {
      throw new ApiError(404, 'User not found');
    }
    throw error;
  }

  const { rows } = await dbPool.query(
    `SELECT ${BUSINESS_USER_PUBLIC_COLUMNS}
     FROM business_users bu
     JOIN users u ON u.id = bu.user_id
     WHERE bu.id = $1`,
    [insertedId]
  );

  res.status(201).json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/members/:userId
* ---------------------------------------------------
*/
const updateBusinessMember = asyncHandler(async (req, res) => {
  // const businessId = parsePositiveInt(req.params.businessId, 'business id');
  const businessId = parseId(req.params.businessId, 'business id');
  // const userId = parsePositiveInt(req.params.userId, 'user id');
  const userId = parseId(req.params.userId, 'user id');

  await loadManageableBusiness(businessId, req.user);

  const data = updateBusinessMemberRequest(req.body);

  const result = await dbPool.query(
    `UPDATE business_users
     SET role = $1
     WHERE business_id = $2 AND user_id = $3
     RETURNING id`,
    [data.role, businessId, userId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Business member not found');
  }

  const { rows } = await dbPool.query(
    `SELECT ${BUSINESS_USER_PUBLIC_COLUMNS}
     FROM business_users bu
     JOIN users u ON u.id = bu.user_id
     WHERE bu.id = $1`,
    [result.rows[0].id]
  );

  res.json({ data: rows[0] });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/members/:userId
* ---------------------------------------------------
*/
const removeBusinessMember = asyncHandler(async (req, res) => {
  // const businessId = parsePositiveInt(req.params.businessId, 'business id');
  const businessId = parseId(req.params.businessId, 'business id');
  // const userId = parsePositiveInt(req.params.userId, 'user id');

  const userId = parseId(req.params.userId, 'user id');
  
  await loadManageableBusiness(businessId, req.user);

  const result = await dbPool.query(
    'DELETE FROM business_users WHERE business_id = $1 AND user_id = $2 RETURNING id',
    [businessId, userId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Business member not found');
  }

  res.json({ message: 'Business member removed' });
});

export {
  getBusinessMembers,
  addBusinessMember,
  updateBusinessMember,
  removeBusinessMember,
};