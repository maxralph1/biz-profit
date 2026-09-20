import { PAGE_LINK_WINDOW } from '../constants.js'; 
import buildUrl from './buildUrl.js'; 

export default function buildPageLinks(req, currentPage, lastPage) {
  const links = [];

  links.push({
    url: currentPage > 1 ? buildUrl(req, currentPage - 1) : null,
    label: '« Previous',
    active: false,
  });

  const pageNumbers = new Set([1, lastPage]);
  for (let i = currentPage - PAGE_LINK_WINDOW; i <= currentPage + PAGE_LINK_WINDOW; i++) {
    if (i >= 1 && i <= lastPage) pageNumbers.add(i);
  }

  const sorted = [...pageNumbers].sort((a, b) => a - b);
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) {
      links.push({ url: null, label: '...', active: false });
    }
    links.push({
      url: buildUrl(req, p),
      label: String(p),
      active: p === currentPage,
    });
    prev = p;
  }

  links.push({
    url: currentPage < lastPage ? buildUrl(req, currentPage + 1) : null,
    label: 'Next »',
    active: false,
  });

  return links;
}