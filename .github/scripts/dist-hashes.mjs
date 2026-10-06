#!/usr/bin/env node
// engine-ci regression fallback while tools/engine-hashes.mjs (partition D) is not on the branch.
// Owner: F. Once tools/engine-hashes.mjs exists, engine-ci calls it instead and this file can go.
//
//   node .github/scripts/dist-hashes.mjs --compare engine/dist-hashes.json --work DIR [--pr-body FILE]
//
// For every site recorded in the hashes file: run its recorded `command` with `--out DIR/<slug>`
// (and SITE_CONFIG unset), hash every file of the output, and compare with the recorded `files`
// and `tree` (tree = sha256 of the manifest that `(cd dist && find . -type f -print0 | sort -z |
// xargs -0 sha256sum)` prints, in byte order). A site whose hashes changed passes only when the
// PR body (--pr-body) carries a line `hash: <slug> intended: <reason>` (SPEC 11.2, D-24).
// Exit 0 identical or explained, 1 unexplained change or failed build, 2 usage.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function hashTree(dir) {
  const files = walk(dir).map((f) => `./${f}`).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const map = {};
  let manifest = '';
  for (const f of files) {
    const h = sha(fs.readFileSync(path.join(dir, f)));
    map[f.slice(2)] = h;
    manifest += `${h}  ${f}\n`;
  }
  return { files: map, tree: sha(manifest), count: files.length };
}

function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const file = get('--compare');
  const work = get('--work') || path.join(process.env.RUNNER_TEMP || '/tmp', 'dist-hashes');
  const body = get('--pr-body');
  if (!file) { console.error('usage: dist-hashes.mjs --compare engine/dist-hashes.json --work DIR [--pr-body FILE]'); return 2; }
  const recorded = JSON.parse(fs.readFileSync(path.resolve(REPO, file), 'utf8'));
  const explained = new Set();
  if (body && fs.existsSync(body)) {
    for (const m of fs.readFileSync(body, 'utf8').matchAll(/^\s*hash:\s*([a-z0-9-]+)\s+intended:\s*\S.*$/gim)) explained.add(m[1]);
  }
  let bad = 0;
  for (const [slug, rec] of Object.entries(recorded.sites || {})) {
    const out = path.join(work, slug);
    const parts = rec.command.split(/\s+/).filter(Boolean);
    if (parts[0] !== 'node' || !parts[1]?.startsWith('engine/')) { console.error(`::error::${slug}: unsupported command ${rec.command}`); bad++; continue; }
    const env = { ...process.env };
    delete env.SITE_CONFIG; delete env.OUT_DIR;
    const p = spawnSync(process.execPath, [...parts.slice(1), '--out', out], { cwd: REPO, env, encoding: 'utf8' });
    if (p.status !== 0) { console.error(p.stdout + p.stderr); console.error(`::error::${slug}: build failed (${rec.command})`); bad++; continue; }
    const got = hashTree(out);
    if (got.tree === rec.tree) { console.log(`ok ${slug}: tree ${got.tree.slice(0, 12)} (${got.count} files) identical`); continue; }
    const changed = [], added = [], removed = [];
    for (const [f, h] of Object.entries(got.files)) {
      if (!(f in rec.files)) added.push(f);
      else if (rec.files[f] !== h) changed.push(f);
    }
    for (const f of Object.keys(rec.files)) if (!(f in got.files)) removed.push(f);
    const detail = `changed ${changed.length}, added ${added.length}, removed ${removed.length}`;
    const list = [...changed.map((f) => `~ ${f}`), ...added.map((f) => `+ ${f}`), ...removed.map((f) => `- ${f}`)].slice(0, 40);
    if (explained.has(slug)) {
      console.log(`explained ${slug}: ${detail} (PR body has "hash: ${slug} intended: ...")`);
    } else {
      console.log(`::error::${slug}: dist differs from engine/dist-hashes.json (${detail}); explain it in the PR body with "hash: ${slug} intended: <reason>" and re-record the hashes`);
      bad++;
    }
    for (const l of list) console.log(`  ${l}`);
  }
  return bad ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
