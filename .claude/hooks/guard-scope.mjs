// Original (site factory). PreToolUse Edit|Write|MultiEdit|NotebookEdit guard (SPEC 8, MASTER-PLAN 5.4).
// Design references: everything-claude-code scripts/hooks/config-protection.js and doc-file-warning.js @ ef648e01 (MIT),
// vendored as lib/config-protection.cjs and lib/doc-guard.cjs.
//
// Rules (ids in guard-rules.json): input-integrity, scope, protected, site-config,
// doc-guard, approval-backstop, and the `event: file` pattern rows (forbidden-content).
// Exit 0 = allow, exit 2 = block with the reason on stderr. Not disabled by FACTORY_HOOKS=off.
// Hub sessions (claude/*, tooling/*, worktree branches, FACTORY_ROLE unset or hub) may edit any path;
// only site sessions are confined to their own folders, and protected files are enforced on main.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, block, allow } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');
const configProtection = require('./lib/config-protection.cjs');
const docGuard = require('./lib/doc-guard.cjs');

const PRE_APPROVAL = new Set(['draft', 'intake', 'questions-sent', 'questions', 'proposal', 'proposed']);
const CREATIVE = /^sites\/([^/]+)\/(content|theme|art|media)\//;

function resultingText(toolInput, abs) {
  const t = toolInput || {};
  if (typeof t.content === 'string') return t.content;
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch { return null; }
  const edits = Array.isArray(t.edits) ? t.edits : [t];
  for (const e of edits) {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') continue;
    if (!text.includes(e.old_string)) return null; // the tool itself will fail; nothing to judge
    text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

// site.config.json: everything except games[].skin|rtp (top level for v1, typeOptions for v2) must be unchanged.
function stripHandEditable(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  const scrub = games => { if (Array.isArray(games)) for (const g of games) if (g && typeof g === 'object') { delete g.skin; delete g.rtp; } };
  scrub(c.games);
  if (c.typeOptions) scrub(c.typeOptions.games);
  return c;
}

function checkSiteConfig(rel, abs, toolInput) {
  if (!/^sites\/[^_/][^/]*\/site\.config\.json$/.test(rel) || !fs.existsSync(abs)) return null;
  let before, after;
  try { before = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return null; }
  const text = resultingText(toolInput, abs);
  if (text === null) return null;
  try { after = JSON.parse(text); } catch {
    return `BLOCKED (site-config): the edit would leave ${rel} invalid JSON.`;
  }
  if (JSON.stringify(stripHandEditable(before)) !== JSON.stringify(stripHandEditable(after))) {
    return `BLOCKED (site-config): ${rel} is derived from orders/<slug>/order.json by node tools/order-to-config.mjs; ` +
      'hand edits are allowed only to games[].skin and games[].rtp (typeOptions.games[] in v2). Change the order and re-run the tool.';
  }
  return null;
}

function checkApproval(rel, treeRoot, ctx) {
  const m = CREATIVE.exec(rel);
  if (!m || m[1] !== ctx.slug) return null;
  const order = F.readJson(path.join(treeRoot, 'orders', ctx.slug, 'order.json'), null);
  if (!order) return null; // legacy site without an order (opalquestlounge)
  const status = String(order.status || order.stage || '').toLowerCase();
  if (PRE_APPROVAL.has(status)) {
    return `BLOCKED (approval-backstop): ${rel} is creative work, but orders/${ctx.slug}/order.json status is "${status}". ` +
      'Creative lanes start only after the Board approvals move the order to approved.';
  }
  return null;
}

function checkPatterns(rel, text, rules) {
  for (const rule of rules) {
    if (rule.event !== 'file' || !rule.pattern) continue;
    if (rule.paths && !new RegExp(rule.paths).test(rel)) continue;
    const m = F.compile(rule).exec(text);
    if (m) return `BLOCKED (${rule.id}): ${rule.message}. Found "${m[0]}" in the text written to ${rel}.`;
  }
  return null;
}

function checkPath(filePath, input, root, rules) {
  const loc = F.locate(filePath, root);
  const treeRoot = loc.treeRoot || root;
  const ctx = F.roleFor(F.readBranch(treeRoot), process.env);
  const site = ctx.role === 'spoke' || (ctx.role === 'routine' && ctx.slug);

  // Outside the project: scratch is always fine; site sessions may not write elsewhere.
  if (loc.rel === null) {
    if (F.inScratch(loc.abs)) return null;
    return site ? `BLOCKED (scope): ${loc.abs} is outside the project and the scratchpad; site sessions write only sites/${ctx.slug || '<slug>'}/, orders/${ctx.slug || '<slug>'}/, reports/${ctx.slug || '<slug>'}/ and the scratchpad.` : null;
  }
  const rel = loc.rel;

  if (site) {
    const s = ctx.slug;
    const ok = s && (rel.startsWith(`sites/${s}/`) || rel.startsWith(`orders/${s}/`) || rel.startsWith(`reports/${s}/`));
    if (!ok) {
      return `BLOCKED (scope): ${rel} — site sessions do not edit engine/ or other sites; open a tooling/* PR. ` +
        `This session (${ctx.role}${s ? ' ' + s : ''}, branch ${ctx.branch || 'unknown'}) may write only sites/${s || '<slug>'}/, orders/${s || '<slug>'}/, reports/${s || '<slug>'}/ and the scratchpad.`;
    }
  }

  if (F.enforcesProtection(ctx)) {
    const incoming = F.incomingText(input.tool_input);
    const r = configProtection.run(input, { rel, abs: loc.abs, incoming });
    if (r.exitCode === 2) return r.stderr;
    const sc = checkSiteConfig(rel, loc.abs, input.tool_input);
    if (sc) return sc;
  }

  const dg = docGuard.run(input, { rel, abs: loc.abs });
  if (dg.exitCode === 2) return dg.stderr;

  if (site) {
    const ap = checkApproval(rel, treeRoot, ctx);
    if (ap) return ap;
  }

  return checkPatterns(rel, F.incomingText(input.tool_input), rules);
}

async function main() {
  const { input, error } = await readInput();
  if (!input) return block(`BLOCKED (input-integrity): guard-scope could not read the hook input (${error}); refusing the write (fail closed). Retry with a smaller edit.`);
  const paths = F.targetPaths(input.tool_input);
  if (!paths.length) return block('BLOCKED (input-integrity): no file path in tool_input; refusing the write (fail closed).');
  let rules;
  try { rules = F.loadRules(); } catch (err) {
    return block(`BLOCKED (input-integrity): ${err.message}; refusing the write (fail closed).`);
  }
  const root = F.projectRoot(input);
  for (const p of paths) {
    const reason = checkPath(p, input, root, rules);
    if (reason) return block(reason);
  }
  return allow();
}

main().catch(err => block(`BLOCKED (input-integrity): guard-scope failed (${err && err.message}); refusing the write (fail closed).`));
