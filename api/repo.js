import { checkRepo } from '../lib/repo.js';

// GET /api/repo?repo=owner/name&files=scope.md,prd.md
export default async function handler(req, res) {
  const q = new URL(req.url, 'http://localhost').searchParams;
  const files = (q.get('files') || '').split(',').map((f) => f.trim()).filter(Boolean).slice(0, 20);
  let result;
  try {
    result = await checkRepo(q.get('repo'), files, process.env.GITHUB_TOKEN);
  } catch {
    result = { error: 'github', message: "Couldn't reach GitHub just now." };
  }
  res.statusCode = result.error ? 400 : 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(result));
}
