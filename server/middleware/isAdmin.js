import ApiError from '../utils/errors/ApiError.js';

export default function isAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Forbidden'));
  }
  next();
}