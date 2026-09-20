// import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.POSTGRES_URL;

function makeSupabaseClient() {
  return new Client({
    /**
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }, 
    */ 
    connectionString: connectionString, 
    ssl: { rejectUnauthorized: false }, 
  });
}

function makeLocalClient() {
  return new Client({
    connectionString, 
    ssl: { rejectUnauthorized: false }, 
    
    /**
    user: 'biz_profit',
    password: 'dbviewer',
    // host: 'localhost',
    host: 'http://127.0.0.1',
    port: 5432,
    database: 'biz_profit', 
    */

    /**
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,  
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, 
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE, 
    POSTGRES_HOST: process.env.POSTGRES_HOST, 
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD, 
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL, 
    POSTGRES_URL: process.env.POSTGRES_URL, 
    POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING, 
    POSTGRES_USER: process.env.POSTGRES_USER, 
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY, 
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET, 
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY, 
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY, 
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, 
    SUPABASE_URL: process.env.SUPABASE_URL, 
    */
  });
}

const env = process.env.ENV;
const dbClient =
  env === 'production'  ? makeSupabaseClient() :
  env === 'development' ? makeSupabaseClient() :  // or a dev connectionString
                          makeLocalClient();
                          // makeSupabaseClient();

// Connect once, lazily, at import time for THIS client only.
await dbClient.connect();

export default dbClient;