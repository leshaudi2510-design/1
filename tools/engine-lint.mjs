#!/usr/bin/env node
// Static checks of the engine, the type packs and the Claude layer (SPEC 11.2, MASTER-PLAN D-28/D-39, ECC 9).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, runMain, UsageError, repoRoot, exists, isDir, readJson, readJsonIf, readText, walk, isMain, TOOLS_DIR } from './lib/common.mjs';
import { parseFrontMatter } from './lib/frontmatter.mjs';
import { lintSchema, validate } from './lib/jsonschema.mjs';

const HELP = `Usage: node tools/engine-lint.mjs [checks...] [--notices <VENDORED.json> <THIRD_PARTY_NOTICES.md>]

Checks (no flag = every check). Each check whose inputs do not exist yet
prints "skip" with the reason and does not fail.

  --engine    colour literals (#hex, rgb(, hsl(, oklch() in engine/styles/** and
              engine/games/*/style.css; prose (string literals > 24 chars with a
              space ending in a full stop) in engine/pages/**; site slugs and
              brands (sites/*, registry, seed) anywhere in engine/** except
              engine/games/_legacy/ and lines marked pack-resolver-default
  --strings   every strings.<key> read by engine/client/** exists in
              engine/content/schemas/strings.schema.json and vice versa
  --agents    .claude/agents/*.md: parseable front matter with only the allowed
              fields (name, description, tools, model, effort, maxTurns, memory,
              isolation, omitClaudeMd, permissionMode; metadata.origin for
              vendored files), name = file name, plain tool names in tools, no
              background, Prompt Defense Baseline near the top
  --skills    .claude/skills/*/SKILL.md: front matter parses, name = directory,
              description present, only known fields, positional arguments,
              no Write(/NotebookEdit(/Glob( permission patterns
  --rubrics   .claude/agents/rubrics.json: each judge file exists, its sha256
              matches "hash" and its first body line is "rubricVersion: <v>"
  --context   CLAUDE.md <= 200 lines; .claude/rules/*.md <= 100 lines in total
  --packs     types/*/pack.mjs imports and exports pack contract v0 (id = dir,
              pages(), styles.partials[], mandatory.pageLints[], checks.builds{}),
              template-site/ exists, ids/lint prefixes unique; validated against
              engine/schema/pack.schema.json when it exists
  --schemas   schemas/*.json, engine/schema/*.json, types/*/schema/*.json,
              engine/content/schemas/*.json are draft 2020-12 and compile
  --notices V N   every files[].dest of V (.claude/VENDORED.json) is named in N
              (THIRD_PARTY_NOTICES.md), every source repo is credited, and the
              MIT copyright line of ECC is present when ECC files are vendored
  --json      print { checks: { <name>: { status, errors[], notes[] } }, ok }
  --help      this text
Exit codes: 0 ok (or skipped), 1 any error, 2 usage error.
`;

const AGENT_FIELDS = new Set(['name', 'description', 'tools', 'model', 'effort', 'maxTurns', 'memory', 'isolation', 'omitClaudeMd', 'permissionMode', 'metadata']);
const SKILL_FIELDS = new Set(['name', 'description', 'user-invocable', 'disable-model-invocation', 'arguments', 'argument-hint', 'allowed-tools', 'model', 'effort', 'context', 'agent', 'hooks', 'paths', 'metadata', 'license', 'version', 'when_to_use', 'shell']);

function result() { return { status: 'ok', errors: [], notes: [] }; }
const skip = (r, why) => { r.status = 'skip'; r.notes.push(why); return r; };

function checkEngine(root) {
  const r = result();
  if (!isDir(path.join(root, 'engine'))) return skip(r, 'engine/ does not exist yet (partition A moves it in Phase 1)');
  const styleFiles = [...walk(path.join(root, 'engine', 'styles')).filter((f) => f.endsWith('.css')).map((f) => `engine/styles/${f}`),
    ...(isDir(path.join(root, 'engine', 'games')) ? walk(path.join(root, 'engine', 'games')).filter((f) => f.endsWith('style.css') && !f.startsWith('_legacy/')).map((f) => `engine/games/${f}`) : [])];
  for (const f of styleFiles) {
    const css = readText(path.join(root, f)).replace(/\/\*[\s\S]*?\*\//g, '');
    css.split('\n').forEach((line, i) => { const m = line.match(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/); if (m) r.errors.push(`${f}:${i + 1}: colour literal ${m[0]}`); });
  }
  if (isDir(path.join(root, 'engine', 'pages'))) {
    for (const f of walk(path.join(root, 'engine', 'pages')).filter((x) => x.endsWith('.mjs'))) {
      const src = readText(path.join(root, 'engine', 'pages', f));
      src.split('\n').forEach((line, i) => {
        if (/content\.|pack-resolver-default/.test(line)) return;
        for (const m of line.matchAll(/(['"`])((?:(?!\1).){25,}?)\1/g)) if (/ /.test(m[2]) && /\.\s*$/.test(m[2]) && !/[<>{}$]/.test(m[2])) r.errors.push(`engine/pages/${f}:${i + 1}: prose in a template ("${m[2].slice(0, 40)}...")`);
      });
    }
  }
  const names = new Set();
  const seed = readJsonIf(path.join(TOOLS_DIR, 'data', 'known-fingerprints.json'));
  for (const e of (seed && seed.entries) || []) { names.add(e.slug); if (e.brand) names.add(e.brand); }
  const snap = readJsonIf(path.join(root, 'sites', 'registry.json'));
  for (const e of (snap && (snap.sites || snap.entries)) || []) { names.add(e.slug); if (e.brand) names.add(e.brand); }
  if (isDir(path.join(root, 'sites'))) for (const d of fs.readdirSync(path.join(root, 'sites'))) {
    const c = readJsonIf(path.join(root, 'sites', d, 'site.config.json'));
    if (c && !d.startsWith('_')) { names.add(d); if (c.brand) names.add(c.brand); }
  }
  const list = [...names].filter((n) => n && n.length > 3);
  for (const f of walk(path.join(root, 'engine')).filter((x) => /\.(mjs|js|css|json|html)$/.test(x) && !x.startsWith('games/_legacy/') && !x.startsWith('tools/') && !x.startsWith('docs/') && x !== 'dist-hashes.json')) {
    const lines = readText(path.join(root, 'engine', f)).split('\n');
    lines.forEach((line, i) => { if (/pack-resolver-default/.test(line)) return; for (const n of list) if (line.includes(n)) r.errors.push(`engine/${f}:${i + 1}: names the site "${n}"`); });
  }
  r.notes.push(`${styleFiles.length} stylesheet(s), ${list.length} site names checked`);
  if (r.errors.length) r.status = 'error';
  return r;
}

function checkStrings(root) {
  const r = result();
  const schemaFile = path.join(root, 'engine', 'content', 'schemas', 'strings.schema.json');
  const clientDir = path.join(root, 'engine', 'client');
  if (!isDir(clientDir)) return skip(r, 'engine/client/ does not exist yet');
  if (!exists(schemaFile)) return skip(r, 'engine/content/schemas/strings.schema.json does not exist yet (Phase 2)');
  const used = new Set();
  for (const f of walk(clientDir).filter((x) => /\.(m?js)$/.test(x))) {
    const src = readText(path.join(clientDir, f));
    for (const m of src.matchAll(/\bstrings\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
    for (const m of src.matchAll(/\bstrings\[\s*['"]([^'"]+)['"]\s*\]/g)) used.add(m[1]);
  }
  const schema = readJson(schemaFile);
  const declared = new Set(Object.keys(schema.properties || {}));
  for (const k of used) if (!declared.has(k)) r.errors.push(`strings.${k} is read by engine/client but missing from strings.schema.json`);
  for (const k of declared) if (!used.has(k)) r.errors.push(`strings.schema.json declares "${k}", which engine/client never reads`);
  r.notes.push(`${used.size} key(s) used, ${declared.size} declared`);
  if (r.errors.length) r.status = 'error';
  return r;
}

const plainTools = (v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean);

function checkAgents(root) {
  const r = result();
  const dir = path.join(root, '.claude', 'agents');
  if (!isDir(dir)) return skip(r, '.claude/agents/ does not exist yet (partition E)');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  if (!files.length) return skip(r, '.claude/agents/ has no agent files yet');
  for (const f of files) {
    const at = `.claude/agents/${f}`;
    const text = readText(path.join(dir, f));
    const fm = parseFrontMatter(text);
    if (fm.error) { r.errors.push(`${at}: ${fm.error}`); continue; }
    const d = fm.data;
    for (const k of Object.keys(d)) if (!AGENT_FIELDS.has(k)) r.errors.push(`${at}: field "${k}" is not allowed in agent front matter`);
    if (d.metadata !== undefined) {
      if (!d.metadata || typeof d.metadata !== 'object') r.errors.push(`${at}: metadata must be a map`);
      else for (const k of Object.keys(d.metadata)) if (!['origin', 'rubricVersion'].includes(k)) r.errors.push(`${at}: metadata.${k} is not allowed (metadata.origin only)`);
    }
    if (!d.name) r.errors.push(`${at}: name is required`);
    else if (d.name !== f.replace(/\.md$/, '')) r.errors.push(`${at}: name "${d.name}" differs from the file name`);
    if (!d.description || String(d.description).length < 20) r.errors.push(`${at}: description is required (20+ characters)`);
    if (d.background !== undefined) r.errors.push(`${at}: background is not allowed`);
    if (d.tools !== undefined) for (const t of plainTools(d.tools)) if (!/^[A-Za-z][\w-]*$|^mcp__[\w-]+(__[\w*-]+)?$/.test(t)) r.errors.push(`${at}: tools entry "${t}" is not a plain tool name`);
    if (d.maxTurns !== undefined && !(Number.isInteger(d.maxTurns) && d.maxTurns > 0)) r.errors.push(`${at}: maxTurns must be a positive integer`);
    if (d.omitClaudeMd !== undefined && typeof d.omitClaudeMd !== 'boolean') r.errors.push(`${at}: omitClaudeMd must be true or false`);
    if (d.isolation !== undefined && d.isolation !== 'worktree') r.errors.push(`${at}: isolation must be "worktree"`);
    const head = fm.body.split('\n').slice(0, 40).join('\n');
    if (!/prompt defen[cs]e/i.test(head)) r.notes.push(`${at}: no Prompt Defense Baseline in the first 40 body lines`);
  }
  r.notes.push(`${files.length} agent file(s)`);
  if (r.errors.length) r.status = 'error';
  return r;
}

function checkSkills(root) {
  const r = result();
  const dir = path.join(root, '.claude', 'skills');
  if (!isDir(dir)) return skip(r, '.claude/skills/ does not exist yet (partition E)');
  const dirs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  if (!dirs.length) return skip(r, '.claude/skills/ has no skills yet');
  for (const name of dirs) {
    const at = `.claude/skills/${name}/SKILL.md`;
    const f = path.join(dir, name, 'SKILL.md');
    if (!exists(f)) { r.errors.push(`${at}: missing`); continue; }
    const fm = parseFrontMatter(readText(f));
    if (fm.error) { r.errors.push(`${at}: ${fm.error}`); continue; }
    const d = fm.data;
    for (const k of Object.keys(d)) if (!SKILL_FIELDS.has(k)) r.errors.push(`${at}: field "${k}" is not a known skill front-matter field`);
    if (d.name && d.name !== name) r.errors.push(`${at}: name "${d.name}" differs from the directory`);
    if (!d.description) r.errors.push(`${at}: description is required`);
    if (d.arguments !== undefined) {
      const args = Array.isArray(d.arguments) ? d.arguments : [d.arguments];
      for (const a of args) if (typeof a !== 'string' || a.startsWith('-')) r.errors.push(`${at}: arguments lists positional names only (got ${JSON.stringify(a)})`);
    }
    if (d['allowed-tools'] !== undefined) for (const t of plainTools(d['allowed-tools'])) if (/^(Write|NotebookEdit|Glob)\(/.test(t)) r.errors.push(`${at}: allowed-tools "${t}" grants nothing (use Edit(<path>))`);
    for (const k of ['user-invocable', 'disable-model-invocation']) if (d[k] !== undefined && typeof d[k] !== 'boolean') r.errors.push(`${at}: ${k} must be true or false`);
  }
  r.notes.push(`${dirs.length} skill(s)`);
  if (r.errors.length) r.status = 'error';
  return r;
}

function checkRubrics(root) {
  const r = result();
  const file = path.join(root, '.claude', 'agents', 'rubrics.json');
  if (!exists(file)) return skip(r, '.claude/agents/rubrics.json does not exist yet (partition E)');
  const rub = readJson(file);
  for (const [agent, v] of Object.entries(rub)) {
    if (agent.startsWith('$')) continue;
    const f = path.join(root, '.claude', 'agents', `${agent}.md`);
    if (!exists(f)) { r.errors.push(`rubrics.json: ${agent}: .claude/agents/${agent}.md does not exist`); continue; }
    const text = readText(f);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    if (!v || !v.hash) r.errors.push(`rubrics.json: ${agent}: no hash`);
    else if (String(v.hash).replace(/^sha256:/, '') !== hash) r.errors.push(`rubrics.json: ${agent}: hash ${String(v.hash).slice(0, 12)} differs from the file (${hash.slice(0, 12)}); bump rubricVersion and regenerate (tools/calibrate.mjs --hashes)`);
    const fm = parseFrontMatter(text);
    const first = (fm.body || text).split('\n').map((l) => l.trim()).find((l) => l);
    const m = first && first.match(/^rubricVersion:\s*([\d.]+)/);
    if (!m) r.errors.push(`.claude/agents/${agent}.md: the first body line must be "rubricVersion: ${v && v.rubricVersion}"`);
    else if (v && v.rubricVersion && m[1] !== String(v.rubricVersion)) r.errors.push(`.claude/agents/${agent}.md: rubricVersion ${m[1]} differs from rubrics.json (${v.rubricVersion})`);
  }
  if (r.errors.length) r.status = 'error';
  return r;
}

function checkContext(root) {
  const r = result();
  const claude = path.join(root, 'CLAUDE.md');
  const rulesDir = path.join(root, '.claude', 'rules');
  if (!exists(claude) && !isDir(rulesDir)) return skip(r, 'CLAUDE.md and .claude/rules/ do not exist yet (partition E)');
  const count = (f) => readText(f).split('\n').length - (readText(f).endsWith('\n') ? 1 : 0);
  if (exists(claude)) { const n = count(claude); r.notes.push(`CLAUDE.md ${n} lines`); if (n > 200) r.errors.push(`CLAUDE.md has ${n} lines (limit 200)`); }
  if (isDir(rulesDir)) {
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
    const total = files.reduce((s, f) => s + count(path.join(rulesDir, f)), 0);
    r.notes.push(`.claude/rules ${total} lines in ${files.length} file(s)`);
    if (total > 100) r.errors.push(`.claude/rules/*.md have ${total} lines in total (limit 100)`);
  }
  if (r.errors.length) r.status = 'error';
  return r;
}

async function checkPacks(root) {
  const r = result();
  const typesDir = path.join(root, 'types');
  if (!isDir(typesDir)) return skip(r, 'types/ does not exist yet (partition A)');
  const types = fs.readdirSync(typesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  if (!types.length) return skip(r, 'types/ has no packs yet');
  const packSchemaFile = path.join(root, 'engine', 'schema', 'pack.schema.json');
  const packSchema = readJsonIf(packSchemaFile);
  const prefixes = new Map();
  for (const t of types) {
    const file = path.join(typesDir, t, 'pack.mjs');
    if (!exists(file)) { r.errors.push(`types/${t}/pack.mjs is missing`); continue; }
    let pack;
    try { const mod = await import(new URL(`file://${file}`)); pack = mod.default || mod; } catch (e) { r.errors.push(`types/${t}/pack.mjs does not import: ${e.message}`); continue; }
    const at = `types/${t}/pack.mjs`;
    if (pack.id !== t) r.errors.push(`${at}: id "${pack.id}" differs from the directory "${t}"`);
    if (typeof pack.pages !== 'function') r.errors.push(`${at}: pages(ctx) must be a function`);
    if (!pack.styles || !Array.isArray(pack.styles.partials)) r.errors.push(`${at}: styles.partials must be an array`);
    if (!pack.mandatory || !Array.isArray(pack.mandatory.pageLints)) r.errors.push(`${at}: mandatory.pageLints must be an array`);
    if (!pack.checks || !pack.checks.builds || typeof pack.checks.builds !== 'object') r.errors.push(`${at}: checks.builds must be an object`);
    const tpl = pack.templateSite ? path.resolve(path.dirname(file), pack.templateSite) : path.join(typesDir, t, 'template-site');
    if (!isDir(tpl)) r.errors.push(`${at}: template site ${path.relative(root, tpl)} does not exist`);
    else if (!exists(path.join(tpl, 'site.config.json'))) r.errors.push(`${path.relative(root, tpl)}/site.config.json is missing`);
    if (pack.lintPrefix) { if (prefixes.has(pack.lintPrefix)) r.errors.push(`${at}: lintPrefix "${pack.lintPrefix}" is also used by ${prefixes.get(pack.lintPrefix)}`); prefixes.set(pack.lintPrefix, t); }
    if (pack.lint && Array.isArray(pack.lint.rules)) for (const rule of pack.lint.rules) if (pack.lintPrefix && rule.id && !rule.id.startsWith(`${pack.lintPrefix}.`)) r.errors.push(`${at}: lint rule ${rule.id} lacks the "${pack.lintPrefix}." prefix`);
    if (packSchema) {
      const projected = JSON.parse(JSON.stringify(pack, (k, v) => (typeof v === 'function' ? '[function]' : v)));
      const errs = validate(projected, packSchema, { file: packSchemaFile });
      for (const e of errs.filter((x) => !/function/.test(x.message))) r.notes.push(`${at}: pack.schema.json ${e.path || '(root)'} ${e.message}`);
    }
    if (pack.__error) r.errors.push(`${at}: ${pack.__error}`);
  }
  if (!packSchema) r.notes.push('engine/schema/pack.schema.json not present: contract v0 checked by hand only');
  r.notes.push(`${types.length} pack(s): ${types.join(', ')}`);
  if (r.errors.length) r.status = 'error';
  return r;
}

function checkSchemas(root) {
  const r = result();
  const files = [];
  for (const d of ['schemas', 'engine/schema', 'engine/content/schemas']) if (isDir(path.join(root, d))) for (const f of fs.readdirSync(path.join(root, d)).filter((x) => x.endsWith('.json'))) files.push(`${d}/${f}`);
  if (isDir(path.join(root, 'types'))) for (const t of fs.readdirSync(path.join(root, 'types'))) {
    const d = `types/${t}/schema`;
    if (isDir(path.join(root, d))) for (const f of fs.readdirSync(path.join(root, d)).filter((x) => x.endsWith('.schema.json'))) files.push(`${d}/${f}`);
  }
  if (isDir(path.join(root, 'engine', 'games'))) for (const f of walk(path.join(root, 'engine', 'games')).filter((x) => x.endsWith('skin.schema.json'))) files.push(`engine/games/${f}`);
  if (!files.length) return skip(r, 'no schema files yet');
  for (const f of files) {
    let s; try { s = readJson(path.join(root, f)); } catch (e) { r.errors.push(`${f}: ${e.message}`); continue; }
    if (f === 'schemas/stages.json') continue; // data with $defs, not a schema document
    if (!s.$schema && !s.type && !s.properties && !s.$defs) { r.notes.push(`${f}: not a schema document (skipped)`); continue; }
    for (const p of lintSchema(s)) r.errors.push(`${f}: ${p}`);
  }
  r.notes.push(`${files.length} file(s)`);
  if (r.errors.length) r.status = 'error';
  return r;
}

function checkNotices(root, vendoredFile, noticesFile) {
  const r = result();
  if (!vendoredFile || !noticesFile) throw new UsageError('--notices needs <VENDORED.json> <THIRD_PARTY_NOTICES.md>');
  const vf = path.resolve(root, vendoredFile); const nf = path.resolve(root, noticesFile);
  if (!exists(vf)) return skip(r, `${vendoredFile} does not exist yet (partition E)`);
  if (!exists(nf)) return skip(r, `${noticesFile} does not exist yet (partition H)`);
  const v = readJson(vf); const text = readText(nf);
  const files = Array.isArray(v.files) ? v.files : [];
  for (const [i, f] of files.entries()) {
    for (const k of ['dest', 'src', 'mode']) if (!f[k]) r.errors.push(`${vendoredFile}: files[${i}] has no ${k}`);
    if (f.dest && !text.includes(f.dest)) r.errors.push(`${noticesFile} does not name ${f.dest}`);
  }
  for (const [key, src] of Object.entries(v)) {
    if (key === 'files' || !src || typeof src !== 'object' || !src.repo) continue;
    if (!text.includes(src.repo)) r.errors.push(`${noticesFile} does not credit ${src.repo} (${key})`);
  }
  if (v.ecc && !/Copyright \(c\) 2026 Affaan Mustafa/.test(text)) r.errors.push(`${noticesFile} lacks "Copyright (c) 2026 Affaan Mustafa" (ECC MIT notice)`);
  r.notes.push(`${files.length} vendored file(s)`);
  if (r.errors.length) r.status = 'error';
  return r;
}

async function main(argv) {
  const all = ['engine', 'strings', 'agents', 'skills', 'rubrics', 'context', 'packs', 'schemas'];
  const a = parseArgs(argv, { booleans: [...all, 'notices', 'json', 'help'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const root = repoRoot();
  let chosen = all.filter((k) => a[k]);
  if (!chosen.length && !a.notices) chosen = all;
  const checks = {};
  for (const c of chosen) {
    const fn = { engine: checkEngine, strings: checkStrings, agents: checkAgents, skills: checkSkills, rubrics: checkRubrics, context: checkContext, packs: checkPacks, schemas: checkSchemas }[c];
    checks[c] = await fn(root);
  }
  if (a.notices || (!chosen.length && a._.length === 2)) checks.notices = checkNotices(root, a._[0], a._[1]);
  const ok = Object.values(checks).every((c) => c.status !== 'error');
  if (a.json) process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  else for (const [name, c] of Object.entries(checks)) {
    process.stdout.write(`${c.status === 'ok' ? 'ok   ' : c.status === 'skip' ? 'skip ' : 'ERROR'} --${name}${c.notes.length ? `: ${c.notes.filter((n) => !/: no Prompt Defense|pack.schema.json/.test(n)).join('; ')}` : ''}\n`);
    for (const e of c.errors) process.stdout.write(`  error: ${e}\n`);
    for (const n of c.notes.filter((x) => /: no Prompt Defense|pack.schema.json/.test(x))) process.stdout.write(`  note: ${n}\n`);
  }
  return ok ? 0 : 1;
}

if (isMain(import.meta.url)) runMain(main, HELP);
