import 'dotenv/config';
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
import dbClient from '../../config/db/dbClient.js';

async function resetSchema() {
  if (process.env.ENV !== 'test') return;

  await dbClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await dbClient.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);

  if (process.env.ENV !== 'test') 
    console.log('"public" schema reset.');
}

export default resetSchema;