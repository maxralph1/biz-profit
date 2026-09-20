import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile(); 
import dbClient from '../config/db/dbClient.js';

import seedUsers from '../database/seeds/00_users.js';
import seedBusinesses from '../database/seeds/01_businesses.js';
import seedBusinessUsers from '../database/seeds/02_business_users.js';
import seedTransactionTypes from '../database/seeds/03_transaction_types.js';
import seedTransactions from '../database/seeds/04_transactions.js';
import seedMonthlyTotals from '../database/seeds/05_monthly_totals.js';

export default async function seed() {
  if (!['test', 'development'].includes(process.env.ENV)) {
    console.error(`refusing to seed with ENV="${process.env.ENV}"`);
    process.exitCode = 1;
    await dbClient.end();
    return;
  }

  console.log('seeding database tables ...');

  /** A single client, so BEGIN/COMMIT/ROLLBACK all run on the same connection. */
  // const client = await dbClient.connect();

  try {
    // await client.query('BEGIN');
    await dbClient.query('BEGIN');

    // await client.query(`
    await dbClient.query(`
      TRUNCATE
        users, businesses, business_users,
        transaction_types, transactions, monthly_totals
      RESTART IDENTITY CASCADE
    `);

    const ctx = {};
    await seedUsers(dbClient, ctx);
    await seedBusinesses(dbClient, ctx);
    await seedBusinessUsers(dbClient, ctx);
    await seedTransactionTypes(dbClient, ctx);
    await seedTransactions(dbClient, ctx);
    await seedMonthlyTotals(dbClient, ctx);

    // await client.query('COMMIT');
    await dbClient.query('COMMIT');

    console.log('\n');
    console.log('seeds applied successfully.');
    console.log('\n');
    console.log('Start hacking </>');
    console.log('\n');

  } catch (error) {
    // await client.query('ROLLBACK');
    await dbClient.query('ROLLBACK');
    console.log('\n');
    console.log('error carrying out seeding!');
    console.log('\n');
    console.error(error);
    process.exitCode = 1;

  } finally {
    // client.release();
    await dbClient.end();
  }
}

seed();