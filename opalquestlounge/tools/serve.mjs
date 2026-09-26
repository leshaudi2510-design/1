// Static server for dist/ that behaves like the production hosts:
// pretty URLs, the custom 404, gzip for text, and the Cache-Control that
// Cloudflare Pages would send for each file, read from the build's own
// _headers file (year-long caching for versioned scripts, styles and fonts,
// no-cache for sw.js). The other headers in _headers, such as the CSP, are
// not sent: the pages carry the CSP in a meta tag.
// Usage: node tools/serve.mjs dist 8080
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseHeaders, cacheControlFor } from './lib/headers.mjs';

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
    let file = path.join(root, path.normalize(p));
    let status = 200;
    let body;
    try {
      if (!file.startsWith(root + path.sep)) throw new Error('outside');
      body = await fs.readFile(file);
    } catch {
      status = 404;
      file = path.join(root, '404.html');
      body = await fs.readFile(file);
    }
    const ext = path.extname(file);
    const headers = { 'content-type': TYPES[ext] || 'application/octet-stream' };
    // Read on every request, so a rebuild while the server runs is picked up.
    const rules = parseHeaders(await fs.readFile(path.join(root, '_headers'), 'utf8').catch(() => ''));
    // Like Cloudflare Pages: a 404 is never cached.
    headers['cache-control'] = status === 404 ? 'no-store' : cacheControlFor(rules, url.pathname);
    if (TEXT.test(file) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = zlib.gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(status, headers);
    res.end(body);
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
