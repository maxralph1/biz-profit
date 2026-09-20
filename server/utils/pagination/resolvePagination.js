import { MAX_PER_PAGE, 
         DEFAULT_PER_PAGE } from '../constants.js';

export default function resolvePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, parseInt(req.query.per_page, 10) || DEFAULT_PER_PAGE)
  );
  return { page, perPage, offset: (page - 1) * perPage };
}