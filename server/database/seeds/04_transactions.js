export default async function seedTransactions(client, ctx) {
  const { ada, grace, alan } = ctx.userIds;
  const { 'Acme Coffee': acme, 
          'Beta Freight': beta } = ctx.businessIds;
  const tt = ctx.transactionTypeIds;

  await client.query(`
    INSERT INTO transactions (
      transaction_type_id, business_id, created_by, narration,
      amount, currency, approved, approver_id
    ) VALUES
      ($1, $9, $6, 'January bean order', 150000, 'GBP', TRUE, $7),
      ($2, $9, $6, 'Week 1 counter sales', 84500, 'GBP', TRUE, $7),
      ($3, $9, $6, 'January shop rent', 220000, 'GBP', FALSE, NULL),
      ($4, $10, $6, 'Fleet diesel top-up', 95000, 'GBP', TRUE,  $8),
      ($5, $10, $6, 'Manchester run', 182000, 'GBP', FALSE, NULL),
      ($4, $10, $6, 'Depot fuel card', 43000, 'GBP', FALSE, NULL)
  `, [
    tt['Bean purchase'],    // $1
    tt['Cup sale'],         // $2
    tt['Rent'],             // $3
    tt['Fuel'],             // $4
    tt['Delivery revenue'], // $5
    ada,                    // $6  created_by
    grace,                  // $7  approver
    alan,                   // $8  approver
    acme,                   // $9  business
    beta                    // $10 business
  ]);
}