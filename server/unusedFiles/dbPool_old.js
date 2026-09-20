import pg from 'pg'; 
const { Pool } = pg; 

const connectionString = '';

const dbProduction = new Pool({
  connectionString: connectionString, 
  ssl: { rejectUnauthorized: false }, 
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

const dbDevelopment = new Pool({
  connectionString: connectionString, 
  ssl: { rejectUnauthorized: false }, 
  
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

const dbTest = new Pool({
  connectionString: connectionString, 
  ssl: { rejectUnauthorized: false }, 
  
  /**
  user: 'dbviewer',
  password: 'dbviewer',
  host: 'localhost',
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

const dbPool =
  process.env.ENV === 'production'
    ? dbProduction 
  : process.env.ENV === 'development' 
    ? dbDevelopment
    : dbTest;

export default dbPool;