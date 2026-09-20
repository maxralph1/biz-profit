/** `amount` comes back from pg as a string (BIGINT default). Frontend divides by 10^minor_unit for display. */

/**
const MONTHLY_TOTAL_PUBLIC_COLUMNS = `
  id,
  business_id,
  created_by,
  narration,
  amount,
  currency,
  approved,
  approver_id,
  month_in_review,
  created_at,
  updated_at
`;

*/


const MONTHLY_TOTAL_PUBLIC_COLUMNS = `
  id,
  business_id,
  created_by,
  narration,
  amount,
  currency,
  approved,
  approver_id,
  month_in_review::text AS month_in_review,
  created_at,
  updated_at
`;

export default MONTHLY_TOTAL_PUBLIC_COLUMNS;