export default async function seedBusinesses(dbClient, ctx) {
  const { ada } = ctx.userIds;

  const { rows } = await dbClient.query(`
    INSERT INTO businesses (user_id, name, description) VALUES
      ($1, 'Acme Coffee', 'Independent coffee roaster and café.'),
      ($1, 'Beta Freight', 'Regional logistics and haulage.')
    RETURNING id, name
  `, [ada]);

  ctx.businessIds = Object.fromEntries(rows.map(r => [r.name, r.id]));
}