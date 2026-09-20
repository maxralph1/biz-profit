import dbPool from '../../config/db/dbPool.js';
import ApiError from '../errors/ApiError.js';

/**
 * Returns the business row if the user is allowed to see it.
 * Throws 404 (not 403) for both "doesn't exist" and "not allowed" — the
 * caller cannot distinguish, and neither can an attacker.
 */
export async function loadVisibleBusiness(businessId, user) {
  const { rows } = await dbPool.query(
    `SELECT
       b.id, b.user_id, b.name, b.description, b.created_at, b.updated_at,
       EXISTS (
         SELECT 1 FROM business_users bu
         WHERE bu.business_id = b.id AND bu.user_id = $2
       ) AS connected
     FROM businesses b
     WHERE b.id = $1`,
    [businessId, user.id]
  );

  const row = rows[0];
  if (!row) throw new ApiError(404, 'Business not found');

  const allowed = user.role === 'admin' || row.connected;
  if (!allowed) throw new ApiError(404, 'Business not found');

  delete row.connected;
  return row;
}

/**
 * Stricter check for mutating endpoints: site admin, business admin, or
 * business owner. Ordinary members get the same 404 as strangers.
 */
export async function loadManageableBusiness(businessId, user) {
  const { rows } = await dbPool.query(
    `SELECT
       b.id, b.user_id, b.name, b.description, b.created_at, b.updated_at,
       bu.role AS membership_role
     FROM businesses b
     LEFT JOIN business_users bu
       ON bu.business_id = b.id AND bu.user_id = $2
     WHERE b.id = $1`,
    [businessId, user.id]
  );

  const row = rows[0];
  if (!row) throw new ApiError(404, 'Business not found');

  const allowed =
    user.role === 'admin' ||
    row.membership_role === 'admin' ||
    row.membership_role === 'owner' ||
    row.user_id === user.id;

  if (!allowed) throw new ApiError(404, 'Business not found');

  delete row.membership_role;
  return row;
}