/** Joins the business_users row with the member's user fields so list and single-item responses share one shape. */
const BUSINESS_USER_PUBLIC_COLUMNS = `
  bu.id,
  bu.business_id,
  bu.user_id,
  bu.role,
  bu.created_at,
  bu.updated_at,
  u.username,
  u.first_name,
  u.last_name,
  u.email
`;

export default BUSINESS_USER_PUBLIC_COLUMNS;