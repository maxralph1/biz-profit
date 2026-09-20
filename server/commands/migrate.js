import dbClient from '../config/db/dbClient.js';

import resetSchema from '../database/migrations/000_reset.js';
import createUsersTable from '../database/migrations/create_users_table.js';
import createBusinessesTable from '../database/migrations/create_businesses_table.js';
import createBusinessUsersTable from '../database/migrations/create_business_users_table.js';
import createTransactionTypesTable from '../database/migrations/create_transaction_types_table.js';
import createTransactionsTable from '../database/migrations/create_transactions_table.js';
import createMonthlyTotalsTable from '../database/migrations/create_monthly_totals_table.js';

export default async function migrate() {
  console.log('running migrations ...');
  
  try {
    await resetSchema();
    await createUsersTable();
    await createBusinessesTable();
    await createBusinessUsersTable();
    await createTransactionTypesTable();
    await createTransactionsTable();
    await createMonthlyTotalsTable();

    console.log('\n');
    console.log('migrations completed successfully.');
    console.log('\n');

  } catch (error) {
    console.log('\n');
    console.error('error carrying out migrations!');
    console.log('\n');
    console.error(error);
    process.exitCode = 1;

  } finally {
    console.log('\n');
    await dbClient.end();
  }
}

migrate();