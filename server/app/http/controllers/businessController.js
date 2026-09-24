import asyncHandler from 'express-async-handler';
import dbClient from '../../../config/db/dbClient.js';
import dbPool from '../../../config/db/dbPool.js';
import ApiError from '../../../utils/errors/ApiError.js';
// import buildUrl from '../../../utils/pagination/buildUrl.js';
// import buildPageLinks from '../../../utils/pagination/buildPageLinks.js';
import parseUuid from '../../../utils/http/parseUuid.js';
import paginateResponse from '../../../utils/pagination/paginateResponse.js';
import resolvePagination from '../../../utils/pagination/resolvePagination.js';
import { loadVisibleBusiness, loadManageableBusiness } from '../../../utils/business/access.js';
import BUSINESS_PUBLIC_COLUMNS from '../resources/businessResource.js';
import createBusinessRequest from '../requests/createBusinessRequest.js';
import updateBusinessRequest, { BUSINESS_FK_VIOLATIONS } from '../requests/updateBusinessRequest.js'; 
import withTransaction from '../../../utils/db/withTransaction.js'; 
import writeAudit from '../../../utils/audit/writeAudit.js';

/**
  *  (site admin only routes, except getMyBusinesses method route)
  */

/**
* ---------------------------------------------------
* GET /api/v1/businesses 
* ---------------------------------------------------
*/
const getBusinesses = asyncHandler(async (req, res) => {
  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query('SELECT COUNT(*)::int AS total FROM businesses WHERE deleted_at IS NULL'),
    dbPool.query(
      `SELECT ${BUSINESS_PUBLIC_COLUMNS}
       FROM businesses 
       WHERE deleted_at IS NULL 
       ORDER BY id ASC 
       LIMIT $1 OFFSET $2`,
      [perPage, offset]
    ),
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
    total,
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
* POST /api/v1/businesses
* ---------------------------------------------------
*/
const createBusiness = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = createBusinessRequest(req.body);

  const created = await withTransaction(async (dbClient) => {
    const result = await dbClient.query(
      `INSERT INTO businesses (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING ${BUSINESS_PUBLIC_COLUMNS}`,
      [userId, data.name, data.description]
    );
    const business = result.rows[0]; 

    await writeAudit(dbClient, {
      actor_id: userId, 
      subject_type: 'business', 
      subject_id: business.id, 
      business_id: business.id, 
      action: 'created', 
      payload: { name: business.name }
    });

    return business;
  });

  res.status(201).json({ data: created });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/:id
* ---------------------------------------------------
*/
const getBusiness = asyncHandler(async (req, res) => {
  /**
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid business id');
  }
  */

  const id = parseUuid(req.params.id, 'business id');

  const business = await loadVisibleBusiness(id, req.user);
  res.json({ data: business });
});

/**
* ---------------------------------------------------
* PUT/PATCH /api/v1/businesses/:id
* ---------------------------------------------------
*/
const updateBusiness = asyncHandler(async (req, res) => {
  /**
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid business id');
  }
  */
  const id = parseUuid(req.params.id, 'business id');

  await loadManageableBusiness(id, req.user);

  const data = updateBusinessRequest(req.body);
  const fields = Object.keys(data);
  if (fields.length === 0) {
    throw new ApiError(400, 'No updatable fields provided');
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map((f) => data[f]);
  values.push(id);

  const updated = await withTransaction(async (dbClient) => {
    const result = await dbClient.query(
      `UPDATE businesses
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length} AND deleted_at IS NULL 
       RETURNING ${BUSINESS_PUBLIC_COLUMNS}`,
      values
    );
    if (result.rows.length === 0) {
      throw new ApiError(404, 'Business not found');
    }
    const business = result.rows[0]; 

    await writeAudit(dbClient, {
      actor_id: req.user.id, 
      subject_type: 'business', 
      subject_id: business.id, 
      business_id: business.id, 
      action: 'updated', 
      payload: { changes: data }
    }); 

    return business;
  })

  res.json({ data: updated });
});

/**
* ---------------------------------------------------
* DELETE /api/v1/businesses/:id
* ---------------------------------------------------
*/
const deleteBusiness = asyncHandler(async (req, res) => {
  /**
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid business id');
  }
  */
  const id = parseUuid(req.params.id, 'business id');

  await loadManageableBusiness(id, req.user);

  /**
  try {
    await dbPool.query('DELETE FROM businesses WHERE id = $1', [id]);
  } catch (error) {
    if (error.code === '23503' || error.code === '23001') {
      throw new ApiError(
        409,
        BUSINESS_FK_VIOLATIONS[error.constraint] ??
          'Cannot delete business: it is referenced by existing records.'
      );
    }
    throw error;
  }
  */

  await withTransaction(async (dbClient) => {
    const result = await dbClient.query(
      `UPDATE businesses 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND deleted_at IS NULL 
      RETURNING id`, 
      [id]
    ); 
    if (result.rows.length === 0) {
      throw new ApiError(404, 'Business not found');
    }

    await writeAudit(dbClient, {
      actor_id: req.user.id, 
      subject_type: 'business', 
      subject_id: id, 
      business_id: id, 
      action: 'deleted',
    });
  });

  res.json({ message: 'Business deleted' });
});

/**
* ---------------------------------------------------
* GET /api/v1/businesses/me
* ---------------------------------------------------
*/
const getMyBusinesses = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      `SELECT COUNT(*)::int AS total 
      FROM business_users bu 
      JOIN users u ON u.id = bu.user_id AND u.deleted_at IS NULL 
      WHERE bu.user_id = $1`,
      [userId]
    ),
    dbPool.query(
      `SELECT
         b.id, b.user_id, b.name, b.description,
         b.created_at, b.updated_at,
         bu.role AS membership_role
       FROM businesses b
       JOIN business_users bu ON bu.business_id = b.id 
       JOIN users u ON u.id = bu.user_id AND u.deleted_at IS NULL 
       WHERE bu.user_id = $1 AND b.deleted_at IS NULL 
       ORDER BY b.id ASC
       LIMIT $2 OFFSET $3`,
      [userId, perPage, offset]
    ),
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
    total,
  });
  */
  res.json(paginateResponse(req, {
    rows: dataResult.rows,
    total: countResult.rows[0].total,
    page, perPage, offset,
  }));
});

export {
  getBusinesses,
  createBusiness,
  getBusiness,
  updateBusiness,
  deleteBusiness, 
  getMyBusinesses
};