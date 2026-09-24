import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile(); 
import TransactionType from '../../app/models/TransactionType.js';
import dbClient from '../../config/db/dbClient.js';

async function createTransactionTypesTable() {
  try {
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      await dbClient.query(`
        DROP TABLE IF EXISTS transaction_types
      `);
    };

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS transaction_types (
        ${TransactionType}
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
      CREATE TRIGGER transaction_types_set_updated_at
      BEFORE UPDATE ON transaction_types
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);

    await dbClient.query('COMMIT');

    if (process.env.ENV !== 'test') 
      console.log('"transaction_types" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK'); 

    if (process.env.ENV !== 'test') {
      console.log('error creating transaction_types table!');
      console.log(error);
    }

  } finally {
    // dbClient.end();
  }
};

export default createTransactionTypesTable;