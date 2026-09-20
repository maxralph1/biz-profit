import 'dotenv/config'; 
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
import BusinessUser from '../../app/models/BusinessUser.js';
import dbClient from '../../config/db/dbClient.js';

async function createBusinessUsersTable() {
  try {
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      await dbClient.query(`
        DROP TABLE IF EXISTS business_users
      `);
    };

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS business_users (
        ${BusinessUser}
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
      CREATE TRIGGER business_users_set_updated_at
      BEFORE UPDATE ON business_users
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);

    await dbClient.query('COMMIT');

    if (process.env.ENV !== 'test') 
      console.log('"business_users" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.log('error creating business_users table!');
    console.log(error);

  } finally {
    // dbClient.end();
  }
};

export default createBusinessUsersTable;