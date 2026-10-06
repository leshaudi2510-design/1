// Original (site factory). PreCompact (--precompact) and Stop hook (SPEC 8, MASTER-PLAN 5.4, ECC-ADOPTION A-80..A-82, A-54, A-70, A-89).
// Design references: everything-claude-code scripts/hooks/session-end.js, pre-compact.js, stop-format-typecheck.js,
// cost-tracker.js, skill-run-tracker.js, governance-capture.js @ ef648e01 (MIT); no code copied.
//
// PreCompact: refresh the session summary, append an info event, exit 0.
// Stop (site sessions only: branch site/<slug> | wip/<slug>/*, or FACTORY_ROLE=spoke|routine with SITE_SLUG):
//   gate = `engine/build.mjs sites/<slug> --strict --json` (+ `check --only=pages --workers 2` when
//   content/theme/art/media changed; skipped with a note while another process holds factory-check.lock);
//   failures exit 2 unless stop_hook_active or attempts >= 2, then `blocked: needs operator` + systemMessage + exit 0;
//   checkpoint commit of sites/<slug> and orders/<slug> only — never push.
// Every session: transcript cost row, tool counts, governance warnings -> events.jsonl (reports/<slug>/ or reports/_hub/).
// Hub sessions never run the gate and never commit. FACTORY_HOOKS=off disables the hook. Never calls `claude -p`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, hooksOff, finish } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');
const accumulator = require('./lib/edit-accumulator.cjs');

const MAX_ATTEMPTS = 2;
const SECRET_RES = [/AKIA[0-9A-Z]{16}/, /\bghp_[A-Za-z0-9]{36}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bsk-ant-[A-Za-z0-9_-]{20,}/];
const now = () => new Date().toISOString();
const tmp = name => path.join(os.tmpdir(), name);

// ---------- transcript (incremental, per session) ----------
function stripNoise(s) {
  return String(s || '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').replace(/\s+/g, ' ').trim();
}

function scanTranscript(sid, transcriptPath) {
  const stateFile = tmp(`factory-transcript-${sid}.json`);
  const st = F.readJson(stateFile, null) || {
    offset: 0, cost: { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, modelFamily: '', usdEstimate: null },
    toolCounts: { tools: {}, skills: {}, agents: {} }, seen: [], lastUser: [], governance: [],
  };
  if (!transcriptPath) return st;
  let buf;
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      if (size < st.offset) st.offset = 0; // rotated
      const len = Math.min(size - st.offset, 64 * 1024 * 1024);
      buf = Buffer.alloc(Math.max(0, len));
      if (len > 0) fs.readSync(fd, buf, 0, len, st.offset);
    } finally { fs.closeSync(fd); }
  } catch { return st; }
  const text = buf.toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl < 0) return st;
  st.offset += Buffer.byteLength(text.slice(0, lastNl + 1));
  const seen = new Set(st.seen);
  for (const line of text.slice(0, lastNl).split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const msg = e.message || {};
    if (e.type === 'assistant' && msg.usage) {
      const id = msg.id || e.uuid;
      if (id && !seen.has(id)) {
        seen.add(id);
        const u = msg.usage;
        st.cost.inputTokens += u.input_tokens || 0;
        st.cost.outputTokens += u.output_tokens || 0;
        st.cost.cacheRead += u.cache_read_input_tokens || 0;
        st.cost.cacheWrite += u.cache_creation_input_tokens || 0;
        const fam = /opus|sonnet|haiku/.exec(String(msg.model || ''));
        if (fam) st.cost.modelFamily = fam[0];
      }
    }
    if (e.type === 'assistant' && Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (!b || b.type !== 'tool_use') continue;
        const name = String(b.name || 'unknown');
        st.toolCounts.tools[name] = (st.toolCounts.tools[name] || 0) + 1;
        const inp = b.input || {};
        if (name === 'Skill' && inp.skill) st.toolCounts.skills[inp.skill] = (st.toolCounts.skills[inp.skill] || 0) + 1;
        if ((name === 'Agent' || name === 'Task') && (inp.subagent_type || inp.agentType)) {
          const a = inp.subagent_type || inp.agentType;
          st.toolCounts.agents[a] = (st.toolCounts.agents[a] || 0) + 1;
        }
        const s = JSON.stringify(inp);
        if (SECRET_RES.some(re => re.test(s)) && st.governance.length < 20) st.governance.push(`secret-like value in a ${name} call (redacted)`);
      }
    }
    if (e.type === 'user' && !e.isMeta && msg.role === 'user') {
      const c = msg.content;
      const body = typeof c === 'string' ? c : (Array.isArray(c) && c.every(b => b && b.type === 'text') ? c.map(b => b.text).join(' ') : null);
      const clean = body === null ? '' : stripNoise(body);
      if (clean) st.lastUser = [...st.lastUser, clean.slice(0, 200)].slice(-3);
    }
  }
  st.seen = [...seen].slice(-2000);
  const fresh = st.governance; // reported once, never persisted
  st.governance = [];
  try { fs.writeFileSync(stateFile, JSON.stringify(st)); } catch { /* best effort */ }
  st.governance = fresh;
  return st;
}

// ---------- gate ----------
function editedSiteFiles(sid, root, slug) {
  const out = [];
  for (const p of accumulator.read(sid)) {
    const loc = F.locate(p, root);
    if (loc.rel === null) continue;
    const m = new RegExp(`^sites/${slug}/(.+)$`).exec(loc.rel);
    if (!m || /^(dist[^/]*|public|docs)\//.test(m[1]) || /\.md$/i.test(m[1])) continue;
    out.push(m[1]);
  }
  return out;
}

function lockHeld(lockFile) {
  try {
    const st = fs.statSync(lockFile);
    if (Date.now() - st.mtimeMs > 15 * 60 * 1000) return false;
    const pid = Number(fs.readFileSync(lockFile, 'utf8').trim());
    if (pid && pid !== process.pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
    return false;
  } catch { return false; }
}

function runGate(root, slug, edited) {
  const failures = [];
  const notes = [];
  const build = path.join(root, 'engine', 'build.mjs');
  if (!fs.existsSync(build)) { notes.push('gate skipped: engine/build.mjs not present'); return { failures, notes }; }
  const b = spawnSync(process.execPath, [build, path.join('sites', slug), '--strict', '--json', '--out', tmp(`dist-${slug}`)], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024,
  });
  let r = null;
  try { r = JSON.parse(b.stdout); } catch { /* not JSON */ }
  if (!r) failures.push(`build --strict sites/${slug} did not return JSON (exit ${b.status}${b.signal ? ', ' + b.signal : ''}): ${String(b.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
  else {
    for (const p of (r.problems || [])) failures.push(`build --strict: ${typeof p === 'string' ? p : [p.rule, p.file, p.message || p.msg].filter(Boolean).join(': ')}`);
    if (!(r.problems || []).length && b.status !== 0) failures.push(`build --strict exited ${b.status}`);
  }
  if (!edited.some(f => /^(content|theme|art|media)\//.test(f))) return { failures, notes };
  const check = path.join(root, 'engine', 'tools', 'check.mjs');
  if (!fs.existsSync(check)) { notes.push('pages check skipped: engine/tools/check.mjs not present'); return { failures, notes }; }
  const lock = tmp('factory-check.lock');
  if (lockHeld(lock)) { notes.push('pages check skipped: factory-check.lock is held by another process (run /qa --quick later)'); return { failures, notes }; }
  try { fs.writeFileSync(lock, String(process.pid)); } catch { /* best effort */ }
  const report = tmp(`factory-pages-${slug}.json`);
  try { fs.rmSync(report, { force: true }); } catch { /* ignore */ }
  const c = spawnSync(process.execPath, [check, '--site', path.join('sites', slug), '--only=pages', '--workers', '2', '--report', report], {
    cwd: root, encoding: 'utf8', timeout: 150000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, CHECK_TIMEOUT_MIN: process.env.CHECK_TIMEOUT_MIN || '15' },
  });
  try { fs.rmSync(lock, { force: true }); } catch { /* ignore */ }
  const outText = `${c.stdout || ''}\n${c.stderr || ''}`;
  // A non-zero exit, a `Stopped after` line or a missing report is a FAIL, never green.
  if (c.status !== 0 || /Stopped after/.test(outText) || !fs.existsSync(report)) {
    const tail = outText.trim().split('\n').filter(l => /fail|✗|Stopped after|error/i.test(l)).slice(-15);
    failures.push(`check --only=pages sites/${slug} failed (exit ${c.status}${c.signal ? ', ' + c.signal : ''}${fs.existsSync(report) ? '' : ', no report'})${tail.length ? ':\n  ' + tail.join('\n  ') : ''}`);
  }
  return { failures, notes };
}

function checkpoint(root, slug, stage) {
  const paths = [`sites/${slug}`, `orders/${slug}`].filter(p => fs.existsSync(path.join(root, p)));
  if (!paths.length) return 'nothing to commit';
  const st = spawnSync('git', ['-C', root, 'status', '--porcelain', '--', ...paths], { encoding: 'utf8', timeout: 20000 });
  if (st.status !== 0 || !st.stdout.trim()) return 'clean';
  const add = spawnSync('git', ['-C', root, 'add', '-A', '--', ...paths], { encoding: 'utf8', timeout: 20000 });
  if (add.status !== 0) return `git add failed: ${String(add.stderr).trim().slice(0, 200)}`;
  const c = spawnSync('git', ['-C', root, 'commit', '-q', '-m', `site(${slug}): checkpoint ${stage}`, '--', ...paths], { encoding: 'utf8', timeout: 30000 });
  return c.status === 0 ? 'committed' : `git commit failed: ${String(c.stderr || c.stdout).trim().slice(0, 200)}`;
}

// ---------- main ----------
async function main() {
  if (hooksOff()) return finish(0);
  const { input } = await readInput();
  if (!input) return finish(0);
  const precompact = process.argv.includes('--precompact') || input.hook_event_name === 'PreCompact';
  const sid = F.safeId(input.session_id);
  const root = F.projectRoot(input);
  const ctx = F.roleFor(F.readBranch(root), process.env);
  const site = !!ctx.slug && (ctx.role === 'spoke' || ctx.role === 'routine');
  const repDir = site ? F.reportsDir(root, ctx.slug) : F.reportsDir(root, '_hub', { requireIgnored: true });
  const events = path.join(repDir, 'events.jsonl');
  const base = { at: now(), slug: site ? ctx.slug : '_hub', sessionId: sid };

  const tr = scanTranscript(sid, input.transcript_path);
  const sessionFile = path.join(repDir, 'session.json');
  const summary = { at: base.at, branch: ctx.branch, role: ctx.role, lastUser: tr.lastUser, tools: tr.toolCounts.tools, filesEdited: accumulator.read(sid).slice(-50) };
  if (site) {
    const session = F.readJson(sessionFile, {}) || {};
    session.summary = summary; session.cost = tr.cost; session.toolCounts = tr.toolCounts;
    try { fs.mkdirSync(repDir, { recursive: true }); fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2) + '\n'); } catch { /* best effort */ }
  }

  if (precompact) {
    try { F.appendJsonl(events, { ...base, kind: 'session', severity: 'info', text: `compaction at ${base.at}` }); } catch { /* best effort */ }
    return finish(0);
  }

  let stdout = '';
  if (site) {
    const edited = editedSiteFiles(sid, root, ctx.slug);
    const attemptsFile = tmp(`factory-stop-attempts-${sid}`);
    if (edited.length) {
      const { failures, notes } = runGate(root, ctx.slug, edited);
      for (const n of notes) try { F.appendJsonl(events, { ...base, kind: 'session', severity: 'info', text: n }); } catch { /* ignore */ }
      if (failures.length) {
        let n = 0;
        try { n = Number(fs.readFileSync(attemptsFile, 'utf8')) || 0; } catch { /* first */ }
        n += 1;
        try { fs.writeFileSync(attemptsFile, String(n)); } catch { /* ignore */ }
        const text = `Stop gate for sites/${ctx.slug} failed:\n${failures.join('\n')}`;
        if (!input.stop_hook_active && n < MAX_ATTEMPTS) {
          return finish(2, { stderr: `${text}\nFix these before ending the turn (attempt ${n} of ${MAX_ATTEMPTS}). Placeholders that need operator facts go to orders/${ctx.slug}/questions.md.` });
        }
        try { F.appendJsonl(events, { ...base, kind: 'session', severity: 'warn', text: 'blocked: needs operator', detail: failures.slice(0, 20) }); } catch { /* ignore */ }
        stdout = JSON.stringify({ systemMessage: `blocked: needs operator — ${text}`.slice(0, 4000) });
      } else {
        try { fs.rmSync(attemptsFile, { force: true }); } catch { /* ignore */ }
        accumulator.clear(sid);
      }
    }
    const stage = (F.readJson(sessionFile, {}) || {}).stage || 'session';
    const commit = checkpoint(root, ctx.slug, String(stage).replace(/[^a-z0-9-]/gi, '') || 'session');
    if (commit !== 'clean' && commit !== 'nothing to commit') {
      try { F.appendJsonl(events, { ...base, kind: 'session', severity: commit === 'committed' ? 'info' : 'warn', text: `checkpoint: ${commit}` }); } catch { /* ignore */ }
    }
  }

  try {
    F.appendJsonl(events, { ...base, kind: 'session', severity: 'info', text: `turn end: ${Object.values(tr.toolCounts.tools).reduce((a, b) => a + b, 0)} tool calls`, toolCounts: tr.toolCounts });
    F.appendJsonl(events, { ...base, kind: 'cost', ...tr.cost });
    for (const g of tr.governance) F.appendJsonl(events, { ...base, kind: 'session', severity: 'warn', text: g });
  } catch { /* best effort */ }

  if (site && fs.existsSync(path.join(root, 'tools', 'board.mjs'))) {
    spawnSync(process.execPath, [path.join(root, 'tools', 'board.mjs'), 'row', ctx.slug, '--out', path.join(repDir, 'board-row.json')], { cwd: root, timeout: 20000, stdio: 'ignore' });
  }
  return finish(0, { stdout });
}

main().catch(() => finish(0));
