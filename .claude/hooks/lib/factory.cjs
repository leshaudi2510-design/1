// Original (site factory). Role, branch, path and report-dir helpers shared by the hooks.
// Role detection is the branch (SPEC 8, ECC-ADOPTION 6.2): `site/<slug>` and
// `wip/<slug>/*` are spoke trees; everything else is the hub unless the
// environment says FACTORY_ROLE=spoke|routine. There is no role file.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SLUG = '[a-z0-9][a-z0-9-]*';
const SPOKE_BRANCH = new RegExp(`^(?:site/(${SLUG})|wip/(${SLUG})/.+)$`);
const DEFAULT_BRANCHES = new Set(['main', 'master']);

/** Directory holding .git (dir or worktree file), walking up from `start`. */
function findTreeRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return path.resolve(start || process.cwd());
    dir = up;
  }
}

/** The repository (or worktree) root the hook works in. */
function projectRoot(input, env = process.env) {
  const cwd = (input && typeof input.cwd === 'string' && input.cwd) || env.CLAUDE_PROJECT_DIR || process.cwd();
  return findTreeRoot(cwd);
}

/** Current branch of a tree, read from HEAD without spawning git. '' when detached/unknown. */
function readBranch(treeRoot, env = process.env) {
  if (env.FACTORY_BRANCH) return env.FACTORY_BRANCH; // test/override hook, never set in settings
  try {
    const dotGit = path.join(treeRoot, '.git');
    let gitDir = dotGit;
    const st = fs.statSync(dotGit);
    if (st.isFile()) {
      const m = /^gitdir:\s*(.+)\s*$/m.exec(fs.readFileSync(dotGit, 'utf8'));
      if (!m) return '';
      gitDir = path.resolve(treeRoot, m[1].trim());
    }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    return ref ? ref[1] : '';
  } catch {
    return '';
  }
}

/**
 * Role of a tree: { role: 'hub'|'spoke'|'routine', slug, branch, source }.
 * A spoke branch always wins (lane worktrees inside a hub session are spokes).
 */
function roleFor(branch, env = process.env) {
  const m = SPOKE_BRANCH.exec(branch || '');
  if (m) return { role: 'spoke', slug: m[1] || m[2], branch, source: 'branch' };
  const r = String(env.FACTORY_ROLE || '').toLowerCase();
  const slug = /^[a-z0-9][a-z0-9-]*$/.test(env.SITE_SLUG || '') ? env.SITE_SLUG : '';
  if (r === 'spoke' || r === 'routine') return { role: r, slug, branch, source: 'env' };
  return { role: 'hub', slug, branch, source: r ? 'env' : 'default' };
}

/** Protected files and site.config compliance keys are enforced on the default branch and in site sessions. */
function enforcesProtection(ctx) {
  if (ctx.role === 'spoke') return true;
  if (ctx.role === 'routine' && ctx.slug) return true;
  return DEFAULT_BRANCHES.has(ctx.branch);
}

function scratchDirs(env = process.env) {
  const dirs = [env.CLAUDE_SCRATCHPAD, env.TMPDIR, os.tmpdir(), '/tmp'].filter(Boolean).map(d => path.resolve(d));
  return [...new Set(dirs)];
}

function isUnder(abs, dir) {
  const rel = path.relative(dir, abs);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Strictly inside (not equal to) one of the scratch dirs. */
function inScratch(abs, env = process.env) {
  return scratchDirs(env).some(d => abs !== d && isUnder(abs, d));
}

/**
 * Locate a file path: { abs, treeRoot, rel } where rel is POSIX and relative to the
 * tree the file lives in (a leading `.claude/worktrees/<id>/` is stripped), or null
 * when the file is outside the project.
 */
function locate(filePath, root) {
  const abs = path.resolve(root, String(filePath));
  const posix = abs.split(path.sep).join('/');
  const wt = /^(.*\/\.claude\/worktrees\/[^/]+)(?:\/(.*))?$/.exec(posix);
  if (wt) return { abs, treeRoot: wt[1], rel: wt[2] || '' };
  if (isUnder(abs, root)) return { abs, treeRoot: root, rel: path.relative(root, abs).split(path.sep).join('/') };
  return { abs, treeRoot: null, rel: null };
}

/** reports/<name>/ when reports/ is gitignored in this tree, else a temp dir (never dirty the tree). */
function reportsDir(root, name, { requireIgnored = false } = {}) {
  const dir = path.join(root, 'reports', name);
  if (!requireIgnored) return dir;
  try {
    const r = spawnSync('git', ['-C', root, 'check-ignore', '-q', path.join('reports', name, 'events.jsonl')], { timeout: 5000 });
    if (r.status === 0) return dir;
  } catch { /* fall through */ }
  return path.join(os.tmpdir(), 'factory-reports', name);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function appendJsonl(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8');
}

function safeId(value, fallback = 'default') {
  const s = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return s || fallback;
}

/** Text a write tool is about to put into a file (Write content, Edit/MultiEdit new strings, notebook source). */
function incomingText(toolInput) {
  const t = toolInput || {};
  const parts = [];
  if (typeof t.content === 'string') parts.push(t.content);
  if (typeof t.new_string === 'string') parts.push(t.new_string);
  if (typeof t.new_source === 'string') parts.push(t.new_source);
  if (Array.isArray(t.edits)) for (const e of t.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  return parts.join('\n');
}

/** Every file path a write tool targets. */
function targetPaths(toolInput) {
  const t = toolInput || {};
  const out = [];
  for (const k of ['file_path', 'notebook_path', 'path']) if (typeof t[k] === 'string' && t[k]) out.push(t[k]);
  if (Array.isArray(t.edits)) for (const e of t.edits) if (e && typeof e.file_path === 'string' && e.file_path) out.push(e.file_path);
  return [...new Set(out)];
}

/** Rules table (.claude/hooks/guard-rules.json), resolved next to this library. */
function loadRules() {
  const file = path.join(__dirname, '..', 'guard-rules.json');
  const data = readJson(file, null);
  if (!data || !Array.isArray(data.rules)) throw new Error('guard-rules.json missing or invalid');
  return data.rules;
}

function compile(rule) {
  return new RegExp(rule.pattern, rule.flags || '');
}

module.exports = {
  SPOKE_BRANCH, findTreeRoot, projectRoot, readBranch, roleFor, enforcesProtection,
  scratchDirs, isUnder, inScratch, locate, reportsDir, readJson, appendJsonl, safeId,
  incomingText, targetPaths, loadRules, compile,
};
