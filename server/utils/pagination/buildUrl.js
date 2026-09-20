export default function buildUrl(req, page) {
  const base = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const url = new URL(base);
  url.searchParams.set('page', String(page));
  return url.toString();
}