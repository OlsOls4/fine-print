// Local server: serves public/ and routes /api/* to the same handlers Vercel runs.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import scan from './api/scan.js';
import repo from './api/repo.js';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const routes = { '/api/scan': scan, '/api/repo': repo };
const port = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (routes[path]) return routes[path](req, res);
  const file = normalize(join('public', path === '/' ? 'index.html' : path));
  if (!file.startsWith('public')) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(port, () => console.log(`Fine Print running at http://localhost:${port}`));
