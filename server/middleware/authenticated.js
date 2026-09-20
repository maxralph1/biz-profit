import 'dotenv/config'; 
import jwt from 'jsonwebtoken';
import ApiError from '../utils/errors/ApiError.js';

export default function authenticated(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }

  const user = payload?.user;
  if (!user?.id) {
    return next(new ApiError(401, 'Invalid token payload'));
  }

  req.user = {
    id: user?.id,
    role: user?.role,
  };
  next();
}