import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist-pages'), prefix = '/wordjourney/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' || !url.pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    const file = resolve(root, !path || path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(root + sep)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(4275, '0.0.0.0', () => console.log('Wordjourney Pages test server ready on port 4275'));
