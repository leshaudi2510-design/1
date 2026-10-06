#!/usr/bin/env node
// Scaffold sites/<slug>/ from the type pack's template site (SPEC 10.4, MASTER-PLAN D-09).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, runMain, UsageError, repoRoot, exists, isDir, readJson, readJsonIf, writeJson, isMain } from './lib/common.mjs';
import { loadOrder, TYPES } from './lib/order.mjs';
import { orderToConfig, orderToConcept, storagePrefixFor, takenPrefixes } from './lib/config.mjs';

const HELP = `Usage: node tools/new-site.mjs <slug> --type <type> [--order <orderDir|order.json>] [options]

Copies types/<type>/template-site/ to sites/<slug>/ and personalises it:
type and storagePrefix (the slug's initials, unique among sites/*), and when
the template config carries them engineVersion (engine/package.json) and
deploy.project (<slug>). With --order the order-derived keys
(tools/order-to-config.mjs) replace the template's placeholders; keys the
template does not have are reported and skipped, so the result still matches
the engine's config schema for that template. checks.json gets the prefix.

Never touches sites/registry.json or the registry branch (the reservation
already exists from /order --approve). Fonts subsetting and make-images run in
Phase 2 (they need the approved-pairings sources and the art interface).

Options:
  --type T      social-casino | online-games | hotel-casino (default: the order's type)
  --order F     order directory or order.json to derive the config from
  --force       replace an existing sites/<slug>/
  --build       run node engine/build.mjs sites/<slug> --json afterwards; exit 1 on problems
  --sites DIR   sites root (default <repo>/sites)
  --help        this text
`;

const SLUG = /^[a-z][a-z0-9-]{2,39}$/;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'check-shots'].includes(e.name) || /^dist-/.test(e.name)) continue;
    const s = path.join(from, e.name); const d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

export function newSite({ slug, type, orderInput = null, force = false, root = repoRoot(), sitesDir = path.join(root, 'sites') }) {
  if (!SLUG.test(slug)) throw new UsageError(`slug must match ${SLUG} (got ${slug})`);
  let order = null;
  if (orderInput) {
    order = loadOrder(orderInput).order;
    if (!type) type = order.type;
    if (order.type && type !== order.type) throw new UsageError(`--type ${type} differs from the order's type ${order.type}`);
  }
  if (!type) throw new UsageError('--type is required (or give --order)');
  if (!TYPES.includes(type)) throw new UsageError(`unknown type ${type} (${TYPES.join(', ')})`);
  const template = path.join(root, 'types', type, 'template-site');
  if (!isDir(template)) throw new Error(`types/${type}/template-site/ does not exist (the type pack ships it; MASTER-PLAN W5/W6)`);
  const dest = path.join(sitesDir, slug);
  if (exists(dest)) {
    if (!force) throw new UsageError(`${path.relative(root, dest)} already exists (use --force to replace it)`);
    fs.rmSync(dest, { recursive: true, force: true });
  }
  copyDir(template, dest);
  const notes = [];
  const cfgFile = path.join(dest, 'site.config.json');
  const tpl = readJsonIf(cfgFile) || {};
  const taken = takenPrefixes(root, slug);
  const prefix = storagePrefixFor(slug, taken);
  let cfg = { ...tpl };
  if (order) {
    const v2 = tpl.schemaVersion === 2;
    const derived = orderToConfig({ ...order, orderId: slug }, { version: v2 ? 2 : 1, root, storagePrefix: prefix });
    for (const [k, v] of Object.entries(derived)) {
      if (k in tpl || ['type', 'storagePrefix'].includes(k)) cfg[k] = v;
      else notes.push(`skipped ${k} (not in the template config)`);
    }
  }
  cfg.type = type;
  cfg.storagePrefix = prefix;
  const enginePkg = readJsonIf(path.join(root, 'engine', 'package.json'));
  if ('engineVersion' in tpl && enginePkg && enginePkg.version) cfg.engineVersion = enginePkg.version;
  if (tpl.deploy && typeof tpl.deploy === 'object') cfg.deploy = { ...tpl.deploy, project: slug };
  writeJson(cfgFile, cfg);
  const checks = path.join(dest, 'checks.json');
  if (exists(checks)) { const c = readJson(checks); if ('storagePrefix' in c) { c.storagePrefix = prefix; writeJson(checks, c); } }
  if (order && exists(path.join(dest, 'concept.json'))) writeJson(path.join(dest, 'concept.json'), orderToConcept({ ...order, orderId: slug }, { root }));
  return { dest, prefix, notes };
}

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['force', 'build', 'help'], strings: ['type', 'order', 'sites'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  if (a._.length !== 1) throw new UsageError('give exactly one slug');
  const root = repoRoot();
  const sitesDir = a.sites ? path.resolve(a.sites) : path.join(root, 'sites');
  const r = newSite({ slug: a._[0], type: a.type, orderInput: a.order, force: a.force, root, sitesDir });
  process.stdout.write(`new-site: ${path.relative(root, r.dest)} from types/${readJson(path.join(r.dest, 'site.config.json')).type}/template-site (storagePrefix ${r.prefix})\n`);
  for (const n of r.notes) process.stdout.write(`  note: ${n}\n`);
  if (a.build) {
    const engine = path.join(root, 'engine', 'build.mjs');
    if (!exists(engine)) { process.stderr.write('new-site: engine/build.mjs does not exist yet; skipped --build\n'); return 0; }
    const b = spawnSync(process.execPath, [engine, r.dest, '--json'], { cwd: root, encoding: 'utf8' });
    const line = String(b.stdout).trim().split('\n').reverse().find((l) => l.startsWith('{'));
    const json = line ? JSON.parse(line) : null;
    const problems = json ? json.problems.length : -1;
    process.stdout.write(`new-site: build ${problems === 0 ? 'clean' : `${problems < 0 ? 'failed' : `${problems} problem(s)`}`}${json ? `, ${json.warnings.length} warning(s)` : ''}\n`);
    return problems === 0 ? 0 : 1;
  }
  return 0;
}

if (isMain(import.meta.url)) runMain(main, HELP);
