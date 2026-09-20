export default async function seedTransactionTypes(dbClient, ctx) {
  const { ada } = ctx.userIds;
  const { 'Acme Coffee': acme, 
          'Beta Freight': beta } = ctx.businessIds;

  const { rows } = await dbClient.query(`
    INSERT INTO transaction_types (business_id, user_id, name, description, type) VALUES
      ($1, $2, 'Bean purchase', 'Green coffee beans from suppliers.', 'debit'),
      ($1, $2, 'Cup sale', 'Counter sales of prepared drinks.', 'credit'),
      ($1, $2, 'Rent', 'Monthly lease on the shop unit.', 'debit'),
      ($3, $2, 'Fuel', 'Diesel for the haulage fleet.', 'debit'),
      ($3, $2, 'Delivery revenue', 'Revenue from completed deliveries.', 'credit')
    RETURNING id, name
  `, [acme, ada, beta]);

  ctx.transactionTypeIds = Object.fromEntries(rows.map(r => [r.name, r.id]));
}