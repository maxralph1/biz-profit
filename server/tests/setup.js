// import dbPool from '../config/db/dbPool.js';
import dbClient from '../config/db/dbClient.js';

import resetSchema from '../database/migrations/000_reset.js';
import createUsersTable from '../database/migrations/create_users_table.js';
import createBusinessesTable from '../database/migrations/create_businesses_table.js';
import createBusinessUsersTable from '../database/migrations/create_business_users_table.js';
import createTransactionTypesTable from '../database/migrations/create_transaction_types_table.js';
import createTransactionsTable from '../database/migrations/create_transactions_table.js';
import createAuditEventsTable from '../database/migrations/create_audit_events_table.js';
import addAuditEventsAppendOnlyTrigger from '../database/migrations/add_audit_events_append_only_trigger.js'; 
import createAuthEventsTable from '../database/migrations/create_auth_events_table.js';
import createMonthlyTotalsTable from '../database/migrations/create_monthly_totals_table.js';

import seedUsers from '../database/seeds/00_users.js';
import seedBusinesses from '../database/seeds/01_businesses.js';
import seedBusinessUsers from '../database/seeds/02_business_users.js';
import seedTransactionTypes from '../database/seeds/03_transaction_types.js';
import seedTransactions from '../database/seeds/04_transactions.js';
import seedMonthlyTotals from '../database/seeds/05_monthly_totals.js'; 

const ALL_TABLES = `
  users, businesses, business_users,
  transaction_types, transactions, audit_events, auth_events, monthly_totals
`;

const client = dbClient;

export async function setupSchema() {
  await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  
  await resetSchema();
  await createUsersTable();
  await createBusinessesTable();
  await createBusinessUsersTable();
  await createTransactionTypesTable();
  await createTransactionsTable();
  await createAuditEventsTable(); 
  await addAuditEventsAppendOnlyTrigger(); 
  await createAuthEventsTable();
  await createMonthlyTotalsTable();
}

export async function resetAndSeed() {
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE ${ALL_TABLES} RESTART IDENTITY CASCADE`);
    const ctx = {};
    await seedUsers(client, ctx);
    await seedBusinesses(client, ctx);
    await seedBusinessUsers(client, ctx);
    await seedTransactionTypes(client, ctx);
    await seedTransactions(client, ctx);
    await seedMonthlyTotals(client, ctx);
    await client.query('COMMIT'); 
    return ctx;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
  /** no finally — the client must stay open for the whole suite */
}

export async function teardown() {
  await dbClient.end();
}