export default async function seedMonthlyTotals(dbClient, ctx) {
  const { ada, grace } = ctx.userIds;
  const { 'Acme Coffee': acme, 'Beta Freight': beta } = ctx.businessIds;

  await dbClient.query(`
    INSERT INTO monthly_totals (
      business_id, created_by, narration, amount, currency, approved, approver_id, month_in_review
    ) VALUES
      ($1, $3, 'Acme — January 2025 net', -285500, 'GBP', TRUE,  $4, '2025-01-01'),
      ($2, $3, 'Beta — January 2025 net', 134000, 'GBP', FALSE, NULL, '2025-01-01')
  `, [acme, beta, ada, grace]);
}