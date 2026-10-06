#!/usr/bin/env node
// Dist manifests and the engine regression record (SPEC 7.4, MASTER-PLAN 9.2 A done-when).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, runMain, UsageError, repoRoot, exists, isDir, readJson, readJsonIf, writeJson, walk, isMain, readText } from './lib/common.mjs';
import { listSites, siteInfo, buildSite, removeTemp } from './lib/sites.mjs';

const HELP = `Usage:
  node tools/engine-hashes.mjs --dir DIST [--normalise] [--site-hash]
  node tools/engine-hashes.mjs --compare engine/dist-hashes.json [--pr-body FILE] [--out FILE] [--only slug,...]
  node tools/engine-hashes.mjs --write [engine/dist-hashes.json] [--only slug,...]

--dir        print a sha256sum-style manifest of DIST ("<sha256>  <path>", one
             line per file, sorted by path, posix separators). With
             --normalise the volatile parts are neutralised first, so two
             builds of identical sources compare equal across version bumps:
               paths    assets/v<hex>/ -> assets/v*/
               content  /assets/v<hex>/ -> /assets/v*/, <meta name="build"
                        content="..."> -> content="*", service-worker cache
                        names '<prefix>-v<hex>' -> '<prefix>-v*'
             --site-hash prints one more line: "<sha256 of the manifest>  *"
--compare    builds every site named in the record (sites/<slug>, fixtures
             under sites/_fixtures/<name>) into a temporary directory and
             compares the sha256 of its normalised manifest with the record.
             A changed hash needs a line "hash: <slug> intended: <reason>" in
             the PR body (--pr-body FILE); unexplained changes exit 1.
             --out writes { sitesBuilt, hashChanges[], ok } (reports/_engine/regression.json).
--write      builds every factory site (+ fixtures) and writes the record.

Record format (engine/dist-hashes.json):
  { "schemaVersion": 1, "algorithm": "...", "sites": { "<slug>": { "hash", "files", "builtAt", "engineVersion" } } }
--compare also reads { "<slug>": "<hash>" } and { "<slug>": { "sha256" | "hash" } }.
Exit codes: 0 ok, 1 unexplained change (or missing site), 2 usage/tool error.
`;

const TEXT = /\.(html|js|mjs|css|json|xml|txt|webmanifest|svg)$|(^|\/)_headers$|(^|\/)_redirects$|(^|\/)CNAME$/;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

export function normaliseContent(txt) {
  return txt
    .replace(/(\/?assets\/)v[0-9a-f]{6,}(\/)/g, '$1v*$2')
    .replace(/(<meta\s+name="build"\s+content=")[^"]*(")/g, '$1*$2')
    .replace(/(['"][a-z0-9]{2,8}-v)[0-9a-f]{6,}(['"])/g, '$1*$2');
}
export const normalisePath = (p) => p.replace(/(^|\/)assets\/v[0-9a-f]{6,}\//, '$1assets/v*/');

/** Manifest lines for a directory. */
export function manifest(dir, { normalise = false } = {}) {
  const lines = [];
  for (const rel of walk(dir, { skip: ['node_modules', '.git'] })) {
    const abs = path.join(dir, rel);
    let buf = fs.readFileSync(abs);
    let p = rel;
    if (normalise) {
      p = normalisePath(rel);
      if (TEXT.test(rel)) buf = Buffer.from(normaliseContent(buf.toString('utf8')));
    }
    lines.push([p, sha(buf)]);
  }
  lines.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return lines.map(([p, h]) => `${h}  ${p}`).join('\n') + (lines.length ? '\n' : '');
}
export const siteHash = (dir) => sha(manifest(dir, { normalise: true }));

function readRecord(file) {
  const r = readJson(file);
  const out = {};
  const src = r.sites && typeof r.sites === 'object' && !Array.isArray(r.sites) ? r.sites : Array.isArray(r) ? Object.fromEntries(r.map((e) => [e.slug, e])) : r;
  for (const [slug, v] of Object.entries(src)) {
    if (slug.startsWith('$') || ['schemaVersion', 'algorithm', 'generatedAt', 'note'].includes(slug)) continue;
    const hash = typeof v === 'string' ? v : v && (v.hash || v.sha256);
    if (hash) out[slug] = { hash, ...(typeof v === 'object' ? v : {}) };
  }
  return out;
}

function siteDirFor(slug, root) {
  for (const d of [path.join(root, 'sites', slug), path.join(root, 'sites', '_fixtures', slug)]) if (isDir(d)) return d;
  return null;
}

function buildAndHash(site, root) {
  const b = buildSite(site, { root });
  try { return { hash: siteHash(b.dist), files: walk(b.dist).length, method: b.method }; } finally { removeTemp(b); }
}

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['normalise', 'normalize', 'site-hash', 'write', 'help'], strings: ['dir', 'compare', 'out', 'pr-body', 'only'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const root = repoRoot();
  const only = a.only ? new Set(a.only.split(',').map((s) => s.trim())) : null;
  if (a.dir) {
    if (!isDir(a.dir)) throw new UsageError(`${a.dir}: no such directory`);
    const m = manifest(a.dir, { normalise: a.normalise || a.normalize });
    process.stdout.write(m);
    if (a['site-hash']) process.stdout.write(`${sha(m)}  *\n`);
    return 0;
  }
  if (a.compare) {
    if (!exists(a.compare)) throw new UsageError(`${a.compare}: no such file`);
    const record = readRecord(a.compare);
    const body = a['pr-body'] && exists(a['pr-body']) ? readText(a['pr-body']) : '';
    const intended = new Map([...body.matchAll(/^hash:\s*([a-z0-9_-]+)\s+intended:\s*(.+)$/gim)].map((m) => [m[1], m[2].trim()]));
    const result = { sitesBuilt: 0, hashChanges: [], missing: [], ok: true };
    for (const [slug, rec] of Object.entries(record)) {
      if (only && !only.has(slug)) continue;
      const dir = siteDirFor(slug, root);
      if (!dir) { result.missing.push(slug); result.ok = false; process.stdout.write(`missing  ${slug}: no sites/${slug}\n`); continue; }
      const h = buildAndHash(siteInfo(dir, root), root);
      result.sitesBuilt++;
      if (h.hash === rec.hash) { process.stdout.write(`same     ${slug} ${h.hash.slice(0, 16)}\n`); continue; }
      const reason = intended.get(slug) || null;
      result.hashChanges.push({ slug, before: rec.hash, after: h.hash, intended: !!reason, reason });
      if (!reason) result.ok = false;
      process.stdout.write(`${reason ? 'intended' : 'CHANGED '} ${slug} ${rec.hash.slice(0, 16)} -> ${h.hash.slice(0, 16)}${reason ? ` (${reason})` : ' (add "hash: <slug> intended: <reason>" to the PR body)'}\n`);
    }
    if (a.out) writeJson(path.resolve(a.out), result);
    return result.ok ? 0 : 1;
  }
  if (a.write) {
    const file = path.resolve(a._[0] || path.join(root, 'engine', 'dist-hashes.json'));
    const enginePkg = readJsonIf(path.join(root, 'engine', 'package.json'));
    const sites = [...listSites(root).filter((s) => s.engine === 'factory'), ...listSites(root, path.join(root, 'sites', '_fixtures'))];
    const prev = exists(file) ? readJson(file) : {};
    const out = { schemaVersion: 1, algorithm: 'sha256 of `node tools/engine-hashes.mjs --dir <dist> --normalise` for a plain build (node engine/build.mjs sites/<slug> --out <dist>)', sites: { ...(prev.sites || {}) } };
    for (const s of sites) {
      if (only && !only.has(s.slug)) continue;
      const h = buildAndHash(s, root);
      out.sites[s.slug] = { hash: h.hash, files: h.files, builtAt: new Date().toISOString(), engineVersion: enginePkg ? enginePkg.version : null };
      process.stdout.write(`${h.hash}  ${s.slug} (${h.files} files, ${h.method})\n`);
    }
    writeJson(file, out);
    return 0;
  }
  throw new UsageError('give --dir, --compare or --write');
}

if (isMain(import.meta.url)) runMain(main, HELP);
