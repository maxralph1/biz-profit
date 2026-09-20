export default async function seedBusinessUsers(dbClient, ctx) {
  const { ada, grace, alan } = ctx.userIds;
  const { 'Acme Coffee': acme, 
          'Beta Freight': beta } = ctx.businessIds;

  await dbClient.query(`
    INSERT INTO business_users (business_id, user_id, role) VALUES
      ($1, $2, 'owner'),
      ($1, $3, 'admin'),
      ($4, $2, 'owner'),
      ($4, $5, 'member')
  `, [acme, ada, grace, beta, alan]);
}