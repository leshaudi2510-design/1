// Original (site factory). Owned by partition P (D-17); committed by E in Phase 1, inert until .mcp.json
// declares the google-ads / gtm / ga4 servers (MASTER-PLAN 5.4, W23, Phase 5 activation).
// Pre (PreToolUse mcp__google-ads__.*|mcp__gtm__.*|mcp__ga4__.*):
//   - FACTORY_ROLE=routine: deny everything (plan rule; see docs/CONTRACT-CHANGES.md note for ppc-daily-report);
//   - any tool whose input names a protected customer id from ppc/accounts.json: deny;
//   - read-only tools (search/get/list/query/run_report/...): allow;
//   - GTM publish / create_version: ask the operator;
//   - every other tool (mutate, publish, upload, create, update, remove, budgets above ppc/policy.json cap,
//     anything unrecognised): deny. Agents are strictly read-only; changes are proposed as PRs.
// Post (--post, PostToolUse): append { at, account, tool, inputHash, summary } to ppc/changelog.jsonl
//   (reports/_ppc/changelog.jsonl while ppc/ does not exist). Exit 0.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, block, finish } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');

const READ_ONLY = /^(search|search_stream|get|list|query|read|describe|fetch|lookup|run_report|run_realtime_report|run_pivot_report|get_[a-z0-9_]+|list_[a-z0-9_]+|search_[a-z0-9_]+|query_[a-z0-9_]+|describe_[a-z0-9_]+)$/i;
const GTM_ASK = /(^|_)(publish|create_version)(_|$)/i;

function parseTool(name) {
  const m = /^mcp__([^_]+(?:-[^_]+)*)__(.+)$/.exec(String(name || ''));
  return m ? { server: m[1], tool: m[2] } : null;
}

function customerIds(obj) {
  const s = JSON.stringify(obj || {});
  const ids = new Set();
  for (const m of s.matchAll(/"(?:customer_id|customerId|login_customer_id|account_id|accountId)"\s*:\s*"?([0-9-]{6,})"?/g)) ids.add(m[1].replace(/-/g, ''));
  return [...ids];
}

function maxBudgetMicros(obj) {
  let max = 0;
  const s = JSON.stringify(obj || {});
  for (const m of s.matchAll(/"(?:amount_micros|amountMicros|budget_micros|daily_budget_micros)"\s*:\s*"?(\d+)"?/g)) max = Math.max(max, Number(m[1]));
  return max;
}

function pre(input, root) {
  const t = parseTool(input.tool_name);
  if (!t) return { deny: `guard-ppc: unrecognised tool name ${input.tool_name}` };
  if (String(process.env.FACTORY_ROLE || '').toLowerCase() === 'routine') {
    return { deny: `guard-ppc: ${input.tool_name} refused — routine sessions get no Ads/GTM/GA4 tool calls through this guard.` };
  }
  const accounts = F.readJson(path.join(root, 'ppc', 'accounts.json'), {}) || {};
  const protectedIds = new Set((accounts.protected || accounts.protectedCustomerIds || []).map(x => String(x).replace(/-/g, '')));
  const hit = customerIds(input.tool_input).find(id => protectedIds.has(id));
  if (hit) return { deny: `guard-ppc: customer ${hit} is protected (ppc/accounts.json); no tool calls against it.` };
  if (READ_ONLY.test(t.tool)) return { allow: true };
  if (t.server === 'gtm' && GTM_ASK.test(t.tool)) return { ask: `GTM ${t.tool} publishes a container version; confirm it is the reviewed workspace.` };
  const policy = F.readJson(path.join(root, 'ppc', 'policy.json'), {}) || {};
  const cap = Number(policy.budgetCapMicros || policy.dailyBudgetCapMicros || 0);
  const budget = maxBudgetMicros(input.tool_input);
  if (cap && budget > cap) return { deny: `guard-ppc: budget ${budget} micros exceeds the cap ${cap} in ppc/policy.json.` };
  return { deny: `guard-ppc: ${input.tool_name} is not a read-only tool. PPC agents never mutate accounts; propose the change in a PR instead.` };
}

function post(input, root) {
  const t = parseTool(input.tool_name) || { server: '?', tool: String(input.tool_name || '?') };
  const file = fs.existsSync(path.join(root, 'ppc'))
    ? path.join(root, 'ppc', 'changelog.jsonl')
    : path.join(F.reportsDir(root, '_ppc', { requireIgnored: true }), 'changelog.jsonl');
  const ids = customerIds(input.tool_input);
  F.appendJsonl(file, {
    at: new Date().toISOString(),
    account: ids[0] || null,
    tool: `${t.server}.${t.tool}`,
    inputHash: 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(input.tool_input || {})).digest('hex'),
    summary: JSON.stringify(input.tool_input || {}).slice(0, 160),
  });
}

async function main() {
  const isPost = process.argv.includes('--post');
  const { input, error } = await readInput();
  if (!input) return isPost ? finish(0) : block(`guard-ppc: could not read the hook input (${error}); refusing (fail closed).`);
  const root = F.projectRoot(input);
  if (isPost) { try { post(input, root); } catch { /* best effort */ } return finish(0); }
  const d = pre(input, root);
  if (d.deny) return block(d.deny);
  if (d.ask) {
    return finish(0, { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: d.ask } }) });
  }
  return finish(0);
}

main().catch(err => (process.argv.includes('--post') ? finish(0) : block(`guard-ppc failed (${err && err.message}); refusing (fail closed).`)));
