import 'dotenv/config'; 
// console.log('[dbClient] CWD:', process.cwd());
// console.log('[dbClient] URL before load:', !!process.env.POSTGRES_URL);
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
// console.log('[dbClient] URL after load:', !!process.env.POSTGRES_URL);

// import { loadEnvFile } from 'node:process';
// import { fileURLToPath } from 'node:url';
// import { dirname, resolve } from 'node:path';

// const __dirname = dirname(fileURLToPath(import.meta.url));
// loadEnvFile(resolve(__dirname, '../../.env'));

import pg from 'pg';
const { Client } = pg;


// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
// import pg from 'pg'; 
// const { Client } = pg; 

const dbProduction = new Client({
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false }, 
}); 

const dbDevelopment = new Client({
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false }, 
}); 

const dbTest = new Client({
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false }, 
  keepAlive: true, 
  keepAliveInitialDelayMillis: 10_000,

  /**
  user: 'dbviewer',
  password: 'dbviewer',
  host: 'postgresql://127.0.0.1:5432/appdb',
  port: 5432,
  database: 'biz_profit',
  */
}); 

const dbClient =
  process.env.ENV === 'production'
    ? dbProduction 
  : process.env.ENV === 'development' 
    ? dbDevelopment
    : dbTest;

await dbClient.connect();

export default dbClient;