import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
import Business from '../../app/models/Business.js';
import dbClient from '../../config/db/dbClient.js';

async function createBusinessesTable() {
  try {
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      await dbClient.query(`
        DROP TABLE IF EXISTS businesses
      `);
    };

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        ${Business}
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
      CREATE TRIGGER businesses_set_updated_at
      BEFORE UPDATE ON businesses
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);

    await dbClient.query('COMMIT');

    if (process.env.ENV !== 'test') 
      console.log('"businesses" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK'); 

    if (process.env.ENV !== 'test') {
      console.log('error creating businesses table!');
      console.log(error);
    }

  } finally {
    // dbClient.end();
  }
};

export default createBusinessesTable;