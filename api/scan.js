import { scan } from '../lib/scan.js';

// GET /api/scan?url=https://<slug>.devpost.com/
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost').searchParams.get('url') || '';
  const result = await scan(url);
  res.statusCode = result.error ? (result.error === 'not_devpost' ? 400 : 502) : 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (!result.error) res.setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600');
  res.end(JSON.stringify(result));
}
