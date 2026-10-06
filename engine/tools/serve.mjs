#!/usr/bin/env node
// Static server for a build folder that behaves like the production hosts:
// pretty URLs, the custom 404, gzip for text, and the Cache-Control that
// Cloudflare Pages would send for each file, read from the build's own
// _headers file (year-long caching for versioned scripts, styles and fonts,
// no-cache for sw.js). The other headers in _headers, such as the CSP, are
// not sent: the pages carry the CSP in a meta tag.
//
//   node engine/tools/serve.mjs <dist> [--port=N] [--host=H]
//   node engine/tools/serve.mjs sites/<slug>/dist 8080      (the old positional port)
//
// --port=0 (the default) takes a free port. The first line on stdout is the
// URL (http://127.0.0.1:<port>/), so a script can read it:
//   url=$(node engine/tools/serve.mjs dist --port=0 | head -1)
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseHeaders, cacheControlFor } from './lib/headers.mjs';
import { MIME } from './lib/harness.mjs';

const USAGE = 'usage: node engine/tools/serve.mjs <dist> [--port=N] [--host=127.0.0.1]';
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith('--') && !['--port', '--host'].includes(args[i - 1]));
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const root = path.resolve(positional[0] || 'dist');
const port = Number(opt('port') ?? positional[1] ?? 0);
const host = opt('host') || '127.0.0.1';
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`error: --port takes 0-65535\n${USAGE}`);
  process.exit(2);
}
if (!existsSync(path.join(root, 'index.html'))) {
  console.error(`error: ${root} holds no build (no index.html)\n${USAGE}`);
  process.exit(2);
}
const TEXT = /\.(html|css|js|json|webmanifest|svg|xml|txt)$/;

const server = http.createServer(async (req, res) => {
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
    body = await fs.readFile(file).catch(() => Buffer.from('Not found'));
  }
  const ext = path.extname(file);
  const headers = { 'content-type': MIME[ext] || 'application/octet-stream' };
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
});
server.on('error', (e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
server.listen(port, host, () => {
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}/`;
  console.log(url);
  console.log(`Serving ${path.relative(process.cwd(), root) || '.'} (Ctrl+C to stop)`);
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
