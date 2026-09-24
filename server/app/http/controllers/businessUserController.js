import asyncHandler from 'express-async-handler';
import dbClient from '../../../config/db/dbClient.js';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import BUSINESS_USER_PUBLIC_COLUMNS from '../resources/businessUserResource.js';
import createBusinessMemberRequest from '../requests/createBusinessMemberRequest.js';
import updateBusinessMemberRequest from '../requests/updateBusinessMemberRequest.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';
import parseUuid from '../../../utils/http/parseUuid.js';
import withTransaction from '../../../utils/db/withTransaction.js';
import writeAudit from '../../../utils/audit/writeAudit.js';

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
  const businessId = parseUuid(req.params.businessId, 'business id');

  /** Listing is a read — any connected member (or site admin) can do it. */
  await loadVisibleBusiness(businessId, req.user);

  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      `SELECT COUNT(*)::int AS total 
      FROM business_users bu 
      JOIN users u ON u.id = bu.user_id AND u.deleted_at IS NULL 
      WHERE bu.business_id = $1`,
      [businessId]
    ),
    dbPool.query(
      `SELECT ${BUSINESS_USER_PUBLIC_COLUMNS}
       FROM business_users bu
       JOIN users u ON u.id = bu.user_id AND u.deleted_at IS NULL 
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
  const businessId = parseUuid(req.params.businessId, 'business id');

  await loadManageableBusiness(businessId, req.user);

  const data = createBusinessMemberRequest(req.body);
  
  const { rows: targetRows } = await dbPool.query(
    'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL',
    [data.user_id]
  );
  if (targetRows.length === 0) {
    throw new ApiError(404, 'User not found');
  }

  /**
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
  */

  const created = await withTransaction(async (dbClient) => {
    let result; 
    try {
      result = await dbClient.query(
        `INSERT INTO business_users (business_id, user_id, role) 
        VALUES ($1, $2, $3) 
        RETURNING id`, 
        [businessId, data.user_id, data.role]
      )
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uq_business_user') {
        throw new ApiError(409, 'User is already a member of this business');
      }
      throw error;
    }
    const membershipId = result.rows[0].id; 

    await writeAudit(dbClient, {
      actor_id: req.user.id, 
      subject_type: 'business_user', 
      subject_id: membershipId, 
      business_id: businessId, 
      action: 'member_added', 
      payload: { user_id: data.user_id, eolw: data.role },
    });

    const { rows } = await dbClient.query(
      `SELECT ${BUSINESS_USER_PUBLIC_COLUMNS}
       FROM business_users bu
       JOIN users u ON u.id = bu.user_id
       WHERE bu.id = $1`,
      [membershipId]
    );
    return rows[0];
  });

  res.status(201).json({ data: created });
});

/**
* ---------------------------------------------------
* PATCH /api/v1/businesses/:businessId/members/:userId
* ---------------------------------------------------
*/
const updateBusinessMember = asyncHandler(async (req, res) => {
  // const businessId = parsePositiveInt(req.params.businessId, 'business id');
  const businessId = parseUuid(req.params.businessId, 'business id');
  // const userId = parsePositiveInt(req.params.userId, 'user id');
  const userId = parseUuid(req.params.userId, 'user id');

  await loadManageableBusiness(businessId, req.user);

  const data = updateBusinessMemberRequest(req.body);

  const updated = await withTransaction(async (dbClient) => {
    const before = await dbClient.query(
      'SELECT id, role FROM business_users WHERE business_id = $1 AND user_id = $2', 
      [businessId, userId]
    ); 
    if (before.rows.length === 0) {
      throw new ApiError(404, 'Business member not found');
    }
    const previousRole = before.rows[0].role;

    const result = await dbClient.query(
      `UPDATE business_users 
      SET role = $1 
      WHERE business_id = $2 AND user_id = $3 
      RETURNING id`, 
      [data.role, businessId, userId]
    ); 
    const membershipId = result.rows[0].id;

    if (previousRole !== data.role) {
      await writeAudit(dbClient, {
        actor_id: req.user.id, 
        subject_type: 'business_user', 
        subject_id: membershipId, 
        business_id: businessId, 
        action: 'member_role_changed', 
        payload: {
          user_id: userId, 
          old_role:previousRole, 
          new_role: data.role
        },
      });
    }
    const { rows } = await dbClient.query(
      `SELECT ${BUSINESS_USER_PUBLIC_COLUMNS}
       FROM business_users bu
       JOIN users u ON u.id = bu.user_id
       WHERE bu.id = $1`,
      [membershipId]
    );
    return rows[0];
  });

  res.json({ data: updated });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:businessId/members/:userId
* ---------------------------------------------------
*/
const removeBusinessMember = asyncHandler(async (req, res) => {
  // const businessId = parsePositiveInt(req.params.businessId, 'business id');
  const businessId = parseUuid(req.params.businessId, 'business id');
  // const userId = parsePositiveInt(req.params.userId, 'user id');

  const userId = parseUuid(req.params.userId, 'user id');
  
  await loadManageableBusiness(businessId, req.user);

  await withTransaction(async (dbClient) => {
    const result = await dbClient.query(
      'DELETE FROM business_users WHERE business_id = $1 AND user_id = $2 RETURNING id, role',
      [businessId, userId]
    );
  
    if (result.rows.length === 0) {
      throw new ApiError(404, 'Business member not found');
    }

    const { id: membershipId, role } = result.rows[0];
    await writeAudit(dbClient, {
      actor_id: req.user.id, 
      subject_type: 'business_user', 
      subject_id: membershipId, 
      business_id: businessId, 
      action: 'member_removed', 
      payload: { user_id: userId, role },
    });
  });
  
  res.json({ message: 'Business member removed' });
});

export {
  getBusinessMembers,
  addBusinessMember,
  updateBusinessMember,
  removeBusinessMember,
};