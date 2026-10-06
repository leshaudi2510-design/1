// Original (site factory). UserPromptSubmit (SPEC 8, MASTER-PLAN 5.4, ECC-ADOPTION I-11, A-52).
// Prints one plain context line, `factory: order <slug> | type <t> | branch <b> | last stage <s> | gates <chips>`
// (hub: `factory: hub | branch <b> | ...`), plus a `/compact Next: <stage> for <slug>` nudge once per
// 60k-token bucket from lib/suggest-compact.cjs (vendored from everything-claude-code @ ef648e01, MIT).
// Cheap: reads HEAD, reports/<slug>/session.json and site.config.json; no git spawn. FACTORY_HOOKS=off -> silent.
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, hooksOff, finish } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');
const { getTempDir } = require('./lib/utils.cjs');

function chips(gates) {
  if (!gates || typeof gates !== 'object') return 'none';
  const parts = Object.entries(gates).map(([k, v]) => {
    const ok = v === true || v === 'pass' || v === 'green' || (v && v.ok === true);
    const bad = v === false || v === 'fail' || v === 'red' || (v && v.ok === false);
    return `${k}${ok ? '✓' : bad ? '✗' : '·'}`;
  });
  return parts.length ? parts.join(' ') : 'none';
}

async function main() {
  if (hooksOff()) return finish(0);
  const { input } = await readInput();
  const root = F.projectRoot(input || {});
  const ctx = F.roleFor(F.readBranch(root), process.env);
  const slug = ctx.slug;
  let line;
  let stage = '';
  if (slug) {
    const session = F.readJson(path.join(root, 'reports', slug, 'session.json'), {}) || {};
    const cfg = F.readJson(path.join(root, 'sites', slug, 'site.config.json'), {}) || {};
    stage = session.stage || '';
    line = `factory: order ${slug} | type ${cfg.type || 'unknown'} | branch ${ctx.branch || 'detached'} | last stage ${stage || 'none'} | gates ${chips(session.gates)}`;
  } else {
    line = `factory: ${ctx.role} | branch ${ctx.branch || 'detached'} | role from ${ctx.source} | site commands need a slug (SITE_SLUG unset)`;
  }
  const out = [line];
  try {
    const { buildContextSuggestion } = require('./lib/suggest-compact.cjs');
    const sid = F.safeId(input && input.session_id);
    const bucketFile = path.join(getTempDir(), `claude-context-bucket-${sid}`);
    const hint = input && typeof input.transcript_path === 'string'
      ? buildContextSuggestion(input.transcript_path, bucketFile, process.env) : null;
    if (hint) out.push(`${hint.replace('[StrategicCompact] ', 'factory: ')}; write the stage result first, then: /compact Next: ${stage || '<next stage>'}${slug ? ' for ' + slug : ''}`);
  } catch { /* the nudge is optional */ }
  return finish(0, { stdout: out.join('\n') + '\n' });
}

main().catch(() => finish(0));
