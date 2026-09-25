// Static server for dist/ that behaves like the production hosts:
// pretty URLs, the custom 404, gzip for text and long caching for fonts.
// Usage: node tools/serve.mjs dist 8080
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.avif': 'image/avif', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain',
};
const TEXT = /\.(html|css|js|json|webmanifest|svg|xml|txt)$/;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.join(root, p);
    let status = 200;
    let body;
    try {
      body = await fs.readFile(file);
    } catch {
      status = 404;
      file = path.join(root, '404.html');
      body = await fs.readFile(file);
    }
    const ext = path.extname(file);
    const headers = { 'content-type': TYPES[ext] || 'application/octet-stream' };
    headers['cache-control'] = /\/assets\/fonts\//.test(p) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600';
    if (TEXT.test(file) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = zlib.gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(status, headers);
    res.end(body);
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
