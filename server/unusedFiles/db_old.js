import postgres from 'postgres';

/**
 * Production database
 */
const dbProduction = postgres({
  /**
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0, 
  */ 
  
  
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
});

/**
 * Test database
 */
const dbDevelopment = postgres({
  /**
  host: process.env.DB_HOST_DEVELOPMENT,
  database: process.env.DB_DATABASE_DEVELOPMENT,
  user: process.env.DB_USER_DEVELOPMENT,
  password: process.env.DB_PASSWORD_DEVELOPMENT,
  */


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
});

/**
 * Use the production database in production,
 * otherwise use the test database.
 */
const dbConnection =
  process.env.ENV === 'production'
    ? dbProduction
    : dbDevelopment;

export default dbConnection;