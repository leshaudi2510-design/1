// Original (site factory). StopFailure (async) hook (MASTER-PLAN 5.4, D-12).
// Appends { kind: 'session', severity: 'warn', text: '<rate_limit|overloaded|...>' } to
// reports/<slug>/events.jsonl (site sessions) or reports/_hub/events.jsonl (hub; temp dir when
// reports/ is not gitignored), mirrored to the Board by /status --sync. Always exits 0.
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, hooksOff, finish } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');

async function main() {
  if (hooksOff()) return finish(0);
  const { input } = await readInput();
  const data = input || {};
  const root = F.projectRoot(data);
  const ctx = F.roleFor(F.readBranch(root), process.env);
  const site = !!ctx.slug && (ctx.role === 'spoke' || ctx.role === 'routine');
  const dir = site ? F.reportsDir(root, ctx.slug) : F.reportsDir(root, '_hub', { requireIgnored: true });
  const reason = [data.error_type, data.error, data.reason, data.stop_reason]
    .find(v => typeof v === 'string' && v) || (data.error && typeof data.error === 'object' && (data.error.type || data.error.message)) || 'stop-failure';
  F.appendJsonl(path.join(dir, 'events.jsonl'), {
    at: new Date().toISOString(), slug: site ? ctx.slug : '_hub', sessionId: F.safeId(data.session_id),
    kind: 'session', severity: 'warn', text: String(reason).slice(0, 200),
  });
  return finish(0);
}

main().catch(() => finish(0));
