import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile(); 
import Transaction from '../../app/models/Transaction.js';
import dbClient from '../../config/db/dbClient.js';

async function createTransactionsTable() {
  try {
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      await dbClient.query(`
        DROP TABLE IF EXISTS transactions
      `);
    };

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        ${Transaction}
      );
    `);

    await dbClient.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await dbClient.query(`
      CREATE TRIGGER transactions_set_updated_at
      BEFORE UPDATE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);

    await dbClient.query('COMMIT');

    if (process.env.ENV !== 'test') 
      console.log('"transactions" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');

    if (process.env.ENV !== 'test') {
      console.log('error creating transactions table!');
      console.log(error);
    }

  } finally {
    // dbClient.end();
  }
};

export default createTransactionsTable;