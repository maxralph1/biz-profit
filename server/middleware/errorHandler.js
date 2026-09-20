import 'dotenv/config';
import ApiError from '../utils/errors/ApiError.js';

/**
const errorHandler = (err, req, res, next) => {
  let statusCode = res?.statusCode === 200 
    ? 500 
    : res?.statusCode; 
  let message = err?.message; 

  res.status(statusCode).json({
    message, 
    error: err, 
    stack: process.env.ENV === 'production' 
            ? null 
            : err?.stack
  });
};

export default errorHandler; 
*/ 


const errorHandler = (err, req, res, next) => {
  // console.log('[errorHandler] err.name:', err?.name);
  // console.log('[errorHandler] err.message:', err?.message);
  // console.log('[errorHandler] err.statusCode:', err?.statusCode);
  // console.log('[errorHandler] err.code:', err?.code);
  // console.log('[errorHandler] err instanceof ApiError:', err instanceof ApiError);
  
  const isProduction = process.env.ENV === 'production';

  /**
  --- Resolve status code ----------------------------
  1. ApiError carries its own statusCode — trust it.
  2. Otherwise, if middleware explicitly set res.status(non-200), use it.
  3. Otherwise, it's an unexpected failure → 500.
  */
  let statusCode;
  if (err instanceof ApiError && Number.isInteger(err.statusCode)) {
    statusCode = err.statusCode;
  } else if (res.statusCode && res.statusCode !== 200) {
    statusCode = res.statusCode;
  } else {
    statusCode = 500;
  }

  /**
  --- Resolve message --------------------------------
  ApiError messages are safe to expose (we wrote them). 
  Anything else is untrusted — generic in production, real in dev.
  */
  let message;
  if (err instanceof ApiError) {
    message = err.message;
  } else if (isProduction) {
    message = 'Internal Server Error';
  } else {
    message = err?.message || 'Internal Server Error';
  }

  /** --- Build body ------------------------------ */
  const body = { message };

  /** Attach per-field validation errors when present. */
  if (err instanceof ApiError && err.errors) {
    body.errors = err.errors;
  }

  if (err instanceof ApiError && err.headers) {
    for (const [name, value] of Object.entries(err.headers)) {
      res.set(name, value);
    }
  }

  /** Internal details only outside production. */
  if (!isProduction) {
    body.error = {
      name: err?.name,
      message: err?.message,
      ...(err instanceof ApiError ? { statusCode: err.statusCode } : {}),
      ...(err?.code ? { code: err.code } : {}),          /** Postgres SQLSTATE */
      ...(err?.detail ? { detail: err.detail } : {}),    /** Postgres detail */
    };
    body.stack = err?.stack;
  }

  res.status(statusCode).json(body);
};

export default errorHandler;