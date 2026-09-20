import 'dotenv/config'; 

export const REFRESH_COOKIE_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.ENV === 'production',
  sameSite: 'lax',
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
};