import 'dotenv/config'; 
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();
import pg from 'pg'; 
const { Pool } = pg; 

const dbProduction = new Pool({
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false }, 
}); 

const dbDevelopment = new Pool({
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false }, 
}); 

const dbTest = new Pool({
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false }, 
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  idleTimeoutMillis: 20_000,
  max: 10,
  
  /**
  user: 'dbviewer',
  password: 'dbviewer',
  host: 'postgresql://127.0.0.1:5432/appdb',
  port: 5432,
  database: 'biz_profit',
  */
}); 

const dbPool =
  process.env.ENV === 'production'
    ? dbProduction 
  : process.env.ENV === 'development' 
    ? dbDevelopment
    : dbTest;

export default dbPool;