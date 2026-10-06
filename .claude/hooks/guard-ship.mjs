// Original (site factory). PreToolUse Bash guard (SPEC 8 D5, MASTER-PLAN 5.4).
// Design references: everything-claude-code scripts/hooks/gateguard-heredoc.js, gateguard-fact-force.js
// (destructive classifier) and pre-bash-commit-quality.js @ ef648e01 (MIT); no code copied.
//
// Rules (ids in guard-rules.json): ship-gate, rm-rf, build-out, foreground-serve, commit-secrets,
// commit-placeholders, commit-message (builtin) and every `event: bash` pattern row.
// Zero-width/bidi characters are stripped before matching. Exit 0 = allow, exit 2 = block.
// Not disabled by FACTORY_HOOKS=off. Fails closed on empty/truncated/invalid input.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, block, allow } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');

const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const SHIP_WINDOW_MS = 30 * 60 * 1000;
const SCRATCH_VARS = new Set(['CLAUDE_SCRATCHPAD', 'TMPDIR', 'TMP', 'TEMP', 'RUNNER_TEMP']);
const CORE_DIRS = new Set(['.git', '.claude', '.github', 'engine', 'types', 'sites', 'orders', 'tools', 'schemas', 'docs', 'artifacts', 'ppc', 'briefs', 'portfolio']);
const SECRET_RES = [
  /AKIA[0-9A-Z]{16}/, /ASIA[0-9A-Z]{16}/, /\bghp_[A-Za-z0-9]{36}\b/, /\bgho_[A-Za-z0-9]{36}\b/, /\bghs_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, /\bsk-ant-[A-Za-z0-9_-]{20,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, /\bAIza[0-9A-Za-z_-]{35}\b/,
];
const PLACEHOLDER_RE = /\b(TODO|TBD|TBC|FIXME|PLACEHOLDER|lorem ipsum)\b|\[(?:to be confirmed|to be decided|tbd|tbc)[^\]]*\]/i;
const MESSAGE_RE = /^(?:(?:site|revert)\([a-z0-9][a-z0-9-]*\): \S|registry: \S|tooling: \S)/;

// ---------- shell-ish tokenizer: words and operators, quotes respected ----------
function tokenize(cmd) {
  const out = [];
  let cur = null;
  let i = 0;
  const push = () => { if (cur !== null) { out.push({ t: 'w', v: cur }); cur = null; } };
  while (i < cmd.length) {
    const c = cmd[i];
    if (c === '\\' && i + 1 < cmd.length) { cur = (cur ?? '') + cmd[i + 1]; i += 2; continue; }
    if (c === "'") { const j = cmd.indexOf("'", i + 1); const end = j < 0 ? cmd.length : j; cur = (cur ?? '') + cmd.slice(i + 1, end); i = end + 1; continue; }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < cmd.length && cmd[j] !== '"') { if (cmd[j] === '\\' && j + 1 < cmd.length) { s += cmd[j + 1]; j += 2; } else s += cmd[j++]; }
      cur = (cur ?? '') + s; i = j + 1; continue;
    }
    if (/\s/.test(c)) { push(); if (c === '\n') out.push({ t: 'op', v: ';' }); i++; continue; }
    const two = cmd.slice(i, i + 2);
    if (two === '&&' || two === '||') { push(); out.push({ t: 'op', v: two }); i += 2; continue; }
    if (c === ';' || c === '|' || c === '&' || c === '(' || c === ')') {
      if (c === '&' && (cmd[i - 1] === '>' || cmd[i + 1] === '>')) { cur = (cur ?? '') + c; i++; continue; } // 2>&1, &>
      push(); out.push({ t: 'op', v: c }); i++; continue;
    }
    cur = (cur ?? '') + c; i++;
  }
  push();
  return out;
}

/** Simple commands: { words, op (terminator), prevOp }. Leading VAR=x assignments and wrappers dropped. */
function segments(cmd) {
  const toks = tokenize(cmd);
  const segs = [];
  let words = [], prevOp = null;
  for (const t of toks) {
    if (t.t === 'w') { words.push(t.v); continue; }
    segs.push({ words, op: t.v, prevOp }); prevOp = t.v; words = [];
  }
  segs.push({ words, op: null, prevOp });
  for (const s of segs) {
    let w = s.words;
    while (w.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]) || ['sudo', 'command', 'exec', 'time', 'nice', 'nohup', 'env'].includes(w[0]))) w = w.slice(1);
    if (w[0] === 'timeout') { s.timeout = true; w = w.slice(1); while (w.length && /^-|^\d/.test(w[0])) w = w.slice(1); }
    s.words = w;
  }
  return segs.filter(s => s.words.length);
}

function gitSub(words) {
  if (path.basename(words[0] || '') !== 'git') return null;
  let i = 1, dir = null;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C' && i + 1 < words.length) { dir = words[i + 1]; i += 2; continue; }
    if (words[i] === '-c' && i + 1 < words.length) { i += 2; continue; }
    i++;
  }
  return { sub: words[i] || '', args: words.slice(i + 1), dir };
}

// ---------- ship gate ----------
const SHIP_PATTERNS = [
  /\bgh\s+api\b.*\bpulls\/\d+\/merge\b/, /enablePullRequestAutoMerge/, /\bgh\.mjs\s+automerge\b/,
  /\bwrangler\s+pages\s+deploy\b/, /\bcf\.mjs\s+(deploy|promote|rollback)\b/, /\bgit\.mjs\s+push\s+main\b/,
  /\bgh\s+api\b.*\/merges\b/, /deploy\.yml\/dispatches/, /\bgh\s+pr\s+merge\b/,
];

function pushesDefault(segs, root) {
  for (const s of segs) {
    const g = gitSub(s.words);
    if (!g || g.sub !== 'push') continue;
    const refs = g.args.filter(a => !a.startsWith('-'));
    if (refs.some((r, i) => i > 0 && /^(\+)?((refs\/heads\/)?(HEAD|[^:]*):)?(refs\/heads\/)?(main|master)$/.test(r))) return true;
    if (refs.length <= 1 && ['main', 'master'].includes(F.readBranch(g.dir ? path.resolve(root, g.dir) : root))) return true;
  }
  return false;
}

function userMessages(transcriptPath) {
  if (!transcriptPath) return [];
  let text = '';
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, 4 * 1024 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      text = buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return []; }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.includes('"user"')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type !== 'user' || e.isSidechain || e.isMeta || !e.message || e.message.role !== 'user') continue;
    const c = e.message.content;
    let body = null;
    if (typeof c === 'string') body = c;
    else if (Array.isArray(c) && c.every(b => b && b.type === 'text')) body = c.map(b => b.text).join('\n');
    if (body === null) continue; // tool results are not the operator typing
    out.push({ text: body.trim(), at: Date.parse(e.timestamp || '') });
  }
  return out;
}

function shipGate(cmd, segs, input, root, ctx) {
  const hit = SHIP_PATTERNS.find(re => re.test(cmd)) || (pushesDefault(segs, root) ? /push main/ : null);
  if (!hit) return null;
  if (ctx.role === 'spoke' || ctx.role === 'routine') {
    return `BLOCKED (ship-gate): merge/deploy/push-to-main/dispatch commands are refused for ${ctx.role} sessions. Only the operator's /ship in the hub can do this.`;
  }
  const now = Date.now();
  const locks = [];
  const reportsRoot = path.join(root, 'reports');
  let names = [];
  try { names = fs.readdirSync(reportsRoot); } catch { /* none */ }
  for (const name of names) {
    const lock = F.readJson(path.join(reportsRoot, name, 'ship.lock'), null);
    if (!lock) continue;
    const exp = Date.parse(lock.expiresAt || '');
    if (!(exp > now)) continue;
    locks.push({ name, lock });
  }
  const pr = /pulls\/(\d+)\//.exec(cmd);
  const project = /--project-name[=\s]+["']?([A-Za-z0-9._-]+)/.exec(cmd);
  const cfSlug = /\bcf\.mjs\s+(?:deploy|promote|rollback)\s+([a-z0-9-]+)/.exec(cmd);
  const tag = /\b(engine-v\d+\.\d+\.\d+)\b/.exec(cmd);
  const bound = locks.filter(({ name, lock }) => {
    if (pr && lock.pr != null && String(lock.pr) !== pr[1]) return false;
    if (pr && lock.pr == null && name !== '_engine') return false;
    if (project && ![lock.project, lock.cfProject, lock.slug].includes(project[1])) return false;
    if (cfSlug && cfSlug[1] !== (lock.slug || name)) return false;
    if (tag && name === '_engine' && lock.tag && lock.tag !== tag[1]) return false;
    return true;
  });
  if (!bound.length) {
    return 'BLOCKED (ship-gate): no unexpired reports/<slug>/ship.lock matches this command (PR, project or tag). ' +
      'Merges, deploys, pushes to main and deploy dispatches go only through /ship <slug>, which writes the lock after the operator types `ship <slug>`.';
  }
  const msgs = userMessages(input.transcript_path);
  for (const { name, lock } of bound) {
    const want = name === '_engine' ? `ship engine ${lock.tag || ''}`.trim() : `ship ${lock.slug || name}`;
    if (msgs.some(m => m.text === want && m.at && now - m.at <= SHIP_WINDOW_MS && m.at <= now + 60000)) return null;
  }
  return 'BLOCKED (ship-gate): a ship.lock exists, but the operator has not typed `ship <slug>` (or `ship engine <tag>`) in this session within the last 30 minutes. The lock is evidence, not the gate.';
}

// ---------- rm -rf ----------
function rmTargets(words) {
  if (path.basename(words[0]) !== 'rm') return null;
  let recursive = false, endOpts = false;
  const targets = [];
  for (const w of words.slice(1)) {
    if (!endOpts && w === '--') { endOpts = true; continue; }
    if (!endOpts && /^--/.test(w)) { if (w === '--recursive') recursive = true; continue; }
    if (!endOpts && /^-[a-zA-Z]+$/.test(w)) { if (/[rR]/.test(w)) recursive = true; continue; }
    targets.push(w);
  }
  return recursive ? targets : null;
}

function varTarget(t) {
  const m = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(.*)$/.exec(t);
  return m ? { name: m[1], rest: m[2] } : null;
}

function rmAllowed(t, cwd, root, ctx) {
  if (!t || t === '*' || /^\/\*?$/.test(t) || /^~/.test(t) || /^\.{1,2}\/?\*?$/.test(t)) return false;
  const v = varTarget(t);
  if (v) {
    const rest = v.rest.replace(/^\/+/, '');
    if (!rest || rest === '*' || /^\.\.?(\/|$)/.test(rest)) return false;
    if (v.name === 'HOME') return false;
    return SCRATCH_VARS.has(v.name) || ctx.role === 'hub';
  }
  if (t.includes('$') || t.includes('`')) return false;
  const abs = path.resolve(cwd, t);
  if (!F.isUnder(abs, root)) return F.inScratch(abs);
  const rel = path.relative(root, abs).split(path.sep).join('/').replace(/\/+$/, '');
  if (!rel || rel === '.' || rel.startsWith('.git/') || rel === '.git') return false;
  const parts = rel.split('/');
  if (parts.includes('node_modules') || parts.includes('check-shots') || parts.some(p => /^dist/.test(p))) return true;
  if (parts[0] === 'reports' && parts.length >= 2) return true;
  if (rel.startsWith('.claude/worktrees/') && parts.length >= 3) return true;
  if (ctx.role !== 'hub') return false;
  if (/[*?]/.test(parts[0])) return false;
  if (parts.length >= 2) return parts[1] !== '*';
  return !CORE_DIRS.has(parts[0]);
}

// ---------- build --out ----------
function buildOut(words, cwd, root, ctx) {
  const idx = words.findIndex(w => /(^|\/)engine\/build\.mjs$/.test(w));
  if (idx < 0) return null;
  const args = words.slice(idx + 1);
  let out = null, site = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') { out = args[i + 1] ?? ''; i++; continue; }
    if (a.startsWith('--out=')) { out = a.slice(6); continue; }
    if (!a.startsWith('-') && site === null) site = a;
  }
  if (out === null) return null;
  const v = varTarget(out);
  if (v) {
    const ok = v.rest.replace(/^\/+/, '') && (SCRATCH_VARS.has(v.name) || ctx.role === 'hub');
    return ok ? null : `BLOCKED (build-out): --out ${out} cannot be verified; use the scratchpad ($CLAUDE_SCRATCHPAD/...) or reports/<slug>/.`;
  }
  const abs = path.resolve(cwd, out);
  const allowedRoots = [path.join(root, 'reports')];
  if (site) allowedRoots.push(path.resolve(cwd, site));
  const inRepo = F.isUnder(abs, root);
  if ((!inRepo && F.inScratch(abs)) || allowedRoots.some(d => abs !== d && F.isUnder(abs, d))) return null;
  return `BLOCKED (build-out): engine/build.mjs --out ${out} is outside the site, reports/, the scratchpad and the OS temp dir.`;
}

// ---------- foreground serve ----------
const SERVE_RE = /(^|\/)engine\/tools\/serve\.mjs$|(^|\/)serve\.mjs$/;
function foregroundServe(segs, input) {
  if (input.tool_input && input.tool_input.run_in_background === true) return null;
  for (const s of segs) {
    const w = s.words;
    const isServe = (w[0] === 'node' && w.slice(1).some(a => SERVE_RE.test(a)))
      || (w[0] === 'npm' && w[1] === 'run' && /^serve|^start$|^preview$/.test(w[2] || ''))
      || (w[0] === 'npx' && /^(serve|http-server)(@|$)/.test(w[1] || ''))
      || (/^python3?$/.test(w[0]) && w[1] === '-m' && w[2] === 'http.server');
    if (!isServe) continue;
    if (s.op === '&' || s.op === '|' || s.timeout) continue;
    return 'BLOCKED (foreground-serve): a foreground server never returns and hangs the agent. Run it with run_in_background: true (or append `&`) and --port=0, then read the URL from its output.';
  }
  return null;
}

// ---------- git commit checks ----------
function stagedDiff(dir, all) {
  const args = ['-C', dir, 'diff', all ? 'HEAD' : '--cached', '-U0', '--no-color', '--no-ext-diff'];
  const r = spawnSync('git', args, { encoding: 'utf8', timeout: 20000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  const files = [];
  let cur = null;
  for (const line of r.stdout.split('\n')) {
    const m = /^\+\+\+ b\/(.+)$/.exec(line);
    if (m) { cur = { file: m[1], added: [] }; files.push(cur); continue; }
    if (cur && line.startsWith('+') && !line.startsWith('+++')) cur.added.push(line.slice(1));
  }
  return files;
}

function commitMessage(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-m' || args[i] === '--message') return args[i + 1] ?? '';
    if (args[i].startsWith('--message=')) return args[i].slice(10);
    if (/^-[a-zA-Z]*m$/.test(args[i]) && !args[i].startsWith('--')) return args[i + 1] ?? '';
  }
  return null;
}

function commitChecks(segs, cwd, root, ctx) {
  for (const s of segs) {
    const g = gitSub(s.words);
    if (!g || g.sub !== 'commit') continue;
    const dir = g.dir ? path.resolve(cwd, g.dir) : cwd;
    const all = g.args.some(a => a === '-a' || a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));
    const files = stagedDiff(dir, all) || [];
    for (const f of files) {
      for (const line of f.added) {
        const re = SECRET_RES.find(r => r.test(line));
        if (re) return `BLOCKED (commit-secrets): ${f.file} adds a secret-looking value matching ${re.source.slice(0, 40)}. Remove it from the change (and rotate it if it is real).`;
      }
    }
    const site = ctx.role === 'spoke' || (ctx.role === 'routine' && ctx.slug);
    if (site) {
      for (const f of files) {
        const inScope = new RegExp(`^sites/${ctx.slug}/(content/|site\\.config\\.json$)`).test(f.file);
        if (!inScope) continue;
        const line = f.added.find(l => PLACEHOLDER_RE.test(l));
        if (line !== undefined) return `BLOCKED (commit-placeholders): ${f.file} adds placeholder text ("${line.trim().slice(0, 80)}"). Ask through orders/${ctx.slug}/questions.md instead of committing a placeholder.`;
      }
      const msg = commitMessage(g.args);
      if (msg !== null && !MESSAGE_RE.test(msg)) {
        return `BLOCKED (commit-message): "${msg.slice(0, 60)}" — site-branch commits use site(${ctx.slug}): <stage|text>, revert(${ctx.slug}): <text>, registry: <op> <slug> or tooling: <text>.`;
      }
    }
  }
  return null;
}

// ---------- main ----------
async function main() {
  const { input, error } = await readInput();
  if (!input) return block(`BLOCKED (input-integrity): guard-ship could not read the hook input (${error}); refusing the command (fail closed).`);
  const raw = input.tool_input && typeof input.tool_input.command === 'string' ? input.tool_input.command : '';
  if (!raw.trim()) return block('BLOCKED (input-integrity): no command in tool_input; refusing (fail closed).');
  const cmd = raw.replace(INVISIBLE, '');
  let rules;
  try { rules = F.loadRules(); } catch (err) { return block(`BLOCKED (input-integrity): ${err.message}; refusing (fail closed).`); }

  const root = F.projectRoot(input);
  const cwd = (typeof input.cwd === 'string' && input.cwd) || root;
  const ctx = F.roleFor(F.readBranch(root), process.env);
  const segs = segments(cmd);

  const ship = shipGate(cmd, segs, input, root, ctx);
  if (ship) return block(ship);

  for (const rule of rules) {
    if (rule.event !== 'bash' || !rule.pattern) continue;
    const m = F.compile(rule).exec(cmd);
    if (m) return block(`BLOCKED (${rule.id}): ${rule.message}. Matched "${m[0].trim().slice(0, 80)}".`);
  }

  for (const s of segs) {
    const targets = rmTargets(s.words);
    if (targets) {
      if (!targets.length) continue;
      const bad = targets.find(t => !rmAllowed(t, cwd, root, ctx));
      if (bad !== undefined) {
        return block(`BLOCKED (rm-rf): recursive rm of "${bad}". Allowed: the scratchpad/OS temp dir, node_modules, dist*, reports/<slug>/, check-shots/, .claude/worktrees/<id>` +
          (ctx.role === 'hub' ? ', and repo sub-paths below the top-level factory folders.' : ' (site session).') + ' Name the exact path and say how to restore it.');
      }
    }
    const out = buildOut(s.words, cwd, root, ctx);
    if (out) return block(out);
  }

  const serve = foregroundServe(segs, input);
  if (serve) return block(serve);

  const commit = commitChecks(segs, cwd, root, ctx);
  if (commit) return block(commit);

  return allow();
}

main().catch(err => block(`BLOCKED (input-integrity): guard-ship failed (${err && err.message}); refusing (fail closed).`));
