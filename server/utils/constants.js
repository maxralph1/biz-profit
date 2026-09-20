import 'dotenv/config'; 
// import { loadEnvFile } from 'node:process'; 
// loadEnvFile();

export const DEFAULT_PER_PAGE = 10; 
export const MAX_PER_PAGE = 100; 
export const PAGE_LINK_WINDOW = 2; 
export const BCRYPT_ROUNDS = (process.env.ENV === 'test') ? 4 : 10;