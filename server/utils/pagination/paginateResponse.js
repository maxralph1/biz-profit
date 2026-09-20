import buildUrl from './buildUrl.js';
import buildPageLinks from './buildPageLinks.js';

/**
 * Builds the Laravel-shaped pagination body shared by every list endpoint.
 */
export default function paginateResponse(req, { rows, total, page, perPage, offset }) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const path = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;

  return {
    current_page: page,
    data: rows,
    first_page_url: buildUrl(req, 1),
    from: rows.length ? offset + 1 : null,
    last_page: lastPage,
    last_page_url: buildUrl(req, lastPage),
    links: buildPageLinks(req, page, lastPage),
    next_page_url: page < lastPage ? buildUrl(req, page + 1) : null,
    path,
    per_page: perPage,
    prev_page_url: page > 1 ? buildUrl(req, page - 1) : null,
    to: rows.length ? offset + rows.length : null,
    total,
  };
}