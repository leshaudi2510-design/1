#!/usr/bin/env node
// Generate sites/_fixtures/reskin-of-oql/: a full copy of the reference site with only
// the brand, slug/domain, storage prefix, palette hues (rotated 30 degrees in OKLCH) and
// the three house-game names changed (SPEC 15.6). It must FAIL tools/uniqueness.mjs --post.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, runMain, UsageError, repoRoot, exists, isDir, walk, readJson, writeJson, isMain } from '../lib/common.mjs';
import { rotateHex } from '../lib/color.mjs';

const HELP = `Usage: node tools/fixtures/make-reskin.mjs [--from DIR] [--to DIR] [--hue DEG] [--force]

Copies the reference site and swaps only its names, prefix and hues, so the
result is "one product with swapped names": the calibration case that
tools/uniqueness.mjs --post must fail and at least two uniqueness skeptics
must call sameProduct (SPEC 15.6).

  --from DIR   source site (default: sites/opalquestlounge, else the legacy
               opalquestlounge/ tree, mapped to the factory layout per SPEC 3.1:
               site.config.json, src/styles/00-tokens.css -> theme/tokens.css,
               src/data/* -> data/, src/public/{favicon.*,assets/{fonts,icons,img}}
               -> public/)
  --to DIR     destination (default: sites/_fixtures/reskin-of-oql)
  --hue DEG    hue rotation for every chromatic colour (default 30)
  --force      replace an existing destination
  --help       this text

Writes <to>/fixture.json with the swaps applied. Text files (.json .css .mjs
.js .md .html .svg .txt) get the name swaps; binaries are copied unchanged.
`;

export const SWAPS = [
  ['Opal Quest Lounge', 'Topaz Quest Lounge'],
  ['Opal Lounge', 'Topaz Lounge'],
  ['opalquestlounge.com', 'topazquestlounge.com'],
  ['OPAL QUEST LOUNGE', 'TOPAZ QUEST LOUNGE'],
  ['Seven Systems', 'Seven Settings'],
  ['Lapidary Wheel', 'Facet Wheel'],
  ['Brilliant Twenty-One', 'Cushion Twenty-One'],
];
const TEXT = /\.(json|css|mjs|js|md|html|svg|txt|webmanifest)$/i;

function legacyMap(from) {
  const map = [];
  const add = (src, dest) => { if (exists(path.join(from, src))) map.push([src, dest]); };
  add('site.config.json', 'site.config.json');
  add('src/styles/00-tokens.css', 'theme/tokens.css');
  for (const f of walk(path.join(from, 'src/data'))) add(`src/data/${f}`, `data/${f}`);
  add('src/public/favicon.svg', 'public/favicon.svg');
  add('src/public/favicon.ico', 'public/favicon.ico');
  for (const d of ['fonts', 'icons', 'img']) for (const f of walk(path.join(from, 'src/public/assets', d))) add(`src/public/assets/${d}/${f}`, `public/assets/${d}/${f}`);
  return map;
}
function factoryMap(from) {
  return walk(from, { skip: ['node_modules', '.git', 'dist', 'docs', 'check-shots', 'reports'] })
    .filter((f) => !/^dist-/.test(f.split('/')[0]))
    .map((f) => [f, f]);
}

export function makeReskin({ from, to, hue = 30, force = false, root = repoRoot() }) {
  if (!isDir(from)) throw new UsageError(`${from}: no such directory`);
  if (exists(to)) {
    if (!force) throw new UsageError(`${to} exists (use --force to replace it)`);
    fs.rmSync(to, { recursive: true, force: true });
  }
  const legacy = isDir(path.join(from, 'src'));
  const files = legacy ? legacyMap(from) : factoryMap(from);
  let rotated = 0;
  for (const [src, dest] of files) {
    const target = path.join(to, dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!TEXT.test(src)) { fs.copyFileSync(path.join(from, src), target); continue; }
    let txt = fs.readFileSync(path.join(from, src), 'utf8');
    for (const [a, b] of SWAPS) txt = txt.split(a).join(b);
    if (/\.css$/.test(dest) && /(^|\/)theme\/|tokens/.test(dest)) {
      txt = txt.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g, (hex) => { const r = rotateHex(hex, hue); if (r.toLowerCase() !== hex.toLowerCase()) rotated++; return r; });
    }
    fs.writeFileSync(target, txt);
  }
  // config: type + storagePrefix (D-48), rotated theme colours
  const cfgFile = path.join(to, 'site.config.json');
  if (exists(cfgFile)) {
    const cfg = readJson(cfgFile);
    const out = {};
    for (const [k, v] of Object.entries(cfg)) out[k] = v;
    if (!out.type) out.type = 'social-casino';
    out.storagePrefix = 'rsk';
    if (out.themeColor) for (const k of Object.keys(out.themeColor)) out.themeColor[k] = rotateHex(out.themeColor[k], hue);
    if (out.deploy && out.deploy.project) out.deploy.project = 'reskin-of-oql';
    writeJson(cfgFile, out);
  }
  const checks = path.join(to, 'checks.json');
  if (exists(checks)) { const c = readJson(checks); if (c.storagePrefix) c.storagePrefix = 'rsk'; writeJson(checks, c); }
  const meta = {
    fixture: 'reskin-of-oql',
    purpose: 'Calibration (SPEC 15.6): one product with swapped names. tools/uniqueness.mjs --post must fail it against sites/opalquestlounge; at least two uniqueness skeptics must say sameProduct: true.',
    generatedBy: 'node tools/fixtures/make-reskin.mjs',
    from: path.relative(root, from) || from,
    layout: legacy ? 'legacy (mapped per SPEC 3.1)' : 'factory',
    swaps: Object.fromEntries(SWAPS),
    storagePrefix: 'rsk',
    hueRotation: hue,
    coloursRotated: rotated,
    expect: { uniquenessPost: 'fail', skeptics: 'sameProduct >= 2 of 3' },
  };
  writeJson(path.join(to, 'fixture.json'), meta);
  return { files: files.length, rotated, layout: meta.layout };
}

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['force', 'help'], strings: ['from', 'to', 'hue'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const root = repoRoot();
  let from = a.from ? path.resolve(a.from) : path.join(root, 'sites', 'opalquestlounge');
  if (!a.from && !isDir(from)) from = path.join(root, 'opalquestlounge');
  const to = a.to ? path.resolve(a.to) : path.join(root, 'sites', '_fixtures', 'reskin-of-oql');
  const hue = a.hue !== undefined ? Number(a.hue) : 30;
  if (!Number.isFinite(hue)) throw new UsageError('--hue must be a number');
  const r = makeReskin({ from, to, hue, force: a.force, root });
  process.stdout.write(`make-reskin: ${path.relative(root, to)} from ${path.relative(root, from)} (${r.layout}): ${r.files} files, ${r.rotated} colours rotated by ${hue} degrees\n`);
  return 0;
}

if (isMain(import.meta.url)) runMain(main, HELP);
