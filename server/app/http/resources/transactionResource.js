/** `amount` comes back from pg as a string (BIGINT default). Keep it that way — the frontend divides by 10^minor_unit for display.
*/
/** if you no longer wish to have the reversal feature, remove this column, "reverses_transaction_id"  and also, the "TRANSACTION_SELECT_COLUMNS" const 
*/
const TRANSACTION_PUBLIC_COLUMNS = `
  id,
  transaction_type_id,
  business_id,
  created_by,
  narration,
  amount,
  currency,
  approved,
  approver_id,
  transaction_date,
  reverses_transaction_id,
  created_at,
  updated_at
`;

/** Same columns plus a computed `is_reversed` flag. Requires the table to be aliased `t` in the FROM clause.
*/
const TRANSACTION_SELECT_COLUMNS = `
  t.id,
  t.transaction_type_id,
  t.business_id,
  t.created_by,
  t.narration,
  t.amount,
  t.currency,
  t.approved,
  t.approver_id,
  t.transaction_date,
  t.reverses_transaction_id,
  t.created_at,
  t.updated_at,
  EXISTS (
    SELECT 1 FROM transactions r WHERE r.reverses_transaction_id = t.id
  ) AS is_reversed
`;

export { TRANSACTION_PUBLIC_COLUMNS, TRANSACTION_SELECT_COLUMNS };
export default TRANSACTION_PUBLIC_COLUMNS;