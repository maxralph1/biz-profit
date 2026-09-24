import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
import User from '../../app/models/User.js';
import dbClient from '../../config/db/dbClient.js';

async function createUsersTable() {
  try {
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      /**
      await dbClient.query(`
        DROP TABLE IF EXISTS monthly_totals; 
        DROP TABLE IF EXISTS transactions; 
        DROP TABLE IF EXISTS transaction_types; 
        DROP TABLE IF EXISTS business_users; 
        DROP TABLE IF EXISTS businesses; 
        DROP TABLE IF EXISTS users;
      `); 
      */
      await dbClient.query(`
        DROP TABLE IF EXISTS users
      `);
    };

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        ${User}
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
      CREATE TRIGGER users_set_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);

    await dbClient.query('COMMIT');

    if (process.env.ENV !== 'test') 
      console.log('"users" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');

    if (process.env.ENV !== 'test') {
      console.log('error creating users table!');
      console.log(error);
    }

  } finally {
    // dbClient.end();
  }
};

export default createUsersTable;