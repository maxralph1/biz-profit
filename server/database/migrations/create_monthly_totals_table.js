import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile(); 
import MonthlyTotal from '../../app/models/MonthlyTotal.js';
import dbClient from '../../config/db/dbClient.js';

async function createMonthlyTotalsTable() {
  try {
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      await dbClient.query(`
        DROP TABLE IF EXISTS monthly_totals
      `);
    };

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS monthly_totals (
        ${MonthlyTotal}
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
      CREATE TRIGGER monthly_totals_set_updated_at
      BEFORE UPDATE ON monthly_totals
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);

    await dbClient.query('COMMIT');

    if (process.env.ENV !== 'test') 
      console.log('"monthly_totals" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');

    if (process.env.ENV !== 'test') {
      console.log('error creating monthly_totals table!');
      console.log(error);
    }

  } finally {
    // dbClient.end();
  }
};

export default createMonthlyTotalsTable;