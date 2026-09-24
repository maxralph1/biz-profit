import asyncHandler from 'express-async-handler';
import dbPool from '../../../../config/db/dbPool.js';
import ApiError from '../../../../utils/errors/ApiError.js';
import parseUuid from '../../../../utils/http/parseUuid.js';
import resolvePagination from '../../../../utils/pagination/resolvePagination.js';
import paginateResponse from '../../../../utils/pagination/paginateResponse.js';

const AUTH_EVENT_PUBLIC_COLUMNS = `
  id,
  user_id,
  event_type,
  attempted_identifier,
  ip,
  user_agent,
  metadata,
  created_at
`;

// ---------------------------------------------------------------------------
// GET /api/v1/me/auth-events
// ---------------------------------------------------------------------------
const getMyAuthEvents = asyncHandler(async (req, res) => {
  const { page, perPage, offset } = resolvePagination(req);

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(
      'SELECT COUNT(*)::int AS total FROM auth_events WHERE user_id = $1',
      [req.user.id]
    ),
    dbPool.query(
      `SELECT ${AUTH_EVENT_PUBLIC_COLUMNS}
       FROM auth_events
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, perPage, offset]
    ),
  ]);

  res.json(paginateResponse(req, {
    rows: dataResult.rows,
    total: countResult.rows[0].total,
    page, perPage, offset,
  }));
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth-events   (admin only)
// Optional filters: user_id, event_type, attempted_identifier, from, to
// ---------------------------------------------------------------------------
const getAuthEvents = asyncHandler(async (req, res) => {
  const { page, perPage, offset } = resolvePagination(req);

  const conditions = [];
  const values = [];

  const { user_id, event_type, attempted_identifier, from, to } = req.query;

  if (user_id) {
    values.push(parseUuid(user_id, 'user_id'));
    conditions.push(`user_id = $${values.length}`);
  }
  if (event_type) {
    if (typeof event_type !== 'string' || event_type.length > 50) {
      throw new ApiError(400, 'Invalid event_type filter');
    }
    values.push(event_type);
    conditions.push(`event_type = $${values.length}`);
  }
  if (attempted_identifier) {
    if (typeof attempted_identifier !== 'string' || attempted_identifier.length > 255) {
      throw new ApiError(400, 'Invalid attempted_identifier filter');
    }
    values.push(attempted_identifier);
    conditions.push(`attempted_identifier = $${values.length}`);
  }
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid from date');
    values.push(d.toISOString());
    conditions.push(`created_at >= $${values.length}`);
  }
  if (to) {
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid to date');
    values.push(d.toISOString());
    conditions.push(`created_at <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countResult, dataResult] = await Promise.all([
    dbPool.query(`SELECT COUNT(*)::int AS total FROM auth_events ${where}`, values),
    dbPool.query(
      `SELECT ${AUTH_EVENT_PUBLIC_COLUMNS}
       FROM auth_events
       ${where}
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

export { getMyAuthEvents, getAuthEvents };