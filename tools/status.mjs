#!/usr/bin/env node
// Portfolio status and the state-machine check (SPEC 5.4, 4.6; MASTER-PLAN 4.4).

import path from 'node:path';
import { parseArgs, runMain, UsageError, repoRoot, readJsonIf, table, isMain } from './lib/common.mjs';
import { portfolio, checkStages, collectOrders, loadStages } from './lib/state.mjs';

const HELP = `Usage: node tools/status.mjs [--table | --json] [--mine] [--check] [--gate <slug>] [--offline-ok]

Reads orders (orders/*/order.json on this branch, plus orders/<slug>/order.json
on every origin/site/<slug> branch, which is newer while a site is in flight),
the registry (origin/registry, else the sites/registry.json snapshot, else the
Phase 1 seed in tools/data/known-fingerprints.json), the Board mirrors
(reports/<slug>/board-row.json) and the latest reports (build, check,
uniqueness). Never changes order state; GitHub is not queried in Phase 1.

  --table        one line per site/order (default)
  --json         the same data as JSON
  --mine         only $SITE_SLUG
  --check        validate schemas/stages.json itself, schemas/board.schema.json
                 stages (when G's file exists), every order's status, and the
                 agreement between Board stage, order.json status (with the
                 post-launch lag of stages.json orderStatusLag) and registry
                 status; exit 1 naming each offending document
  --gate <slug>  launch checklist: done | item | evidence | command that
                 produces the evidence ("missing" for absent ticks)
  --offline-ok   never exit non-zero because GitHub or the registry branch is
                 unreachable (they are optional inputs here anyway)
  --help         this text
`;

const GATE_ITEMS = [
  ['orderValidated', 'node tools/validate-order.mjs orders/<slug> --level launch'],
  ['operatorDetails', 'owner: registry lookup (Companies House URL whose number equals operator.registrationNumber)'],
  ['mailboxWorks', 'node tools/probe.mjs <domain> --mx + a test message (owner)'],
  ['legalReview', 'owner: reviewer name + date in order.json legal'],
  ['datesHonest', 'node tools/validate-order.mjs orders/<slug> --level launch'],
  ['trademark', 'owner: trademark search URL + date'],
  ['strictBuild', 'node engine/build.mjs sites/<slug> --strict --json'],
  ['e2eChecks', 'node engine/tools/check.mjs --site sites/<slug> --report reports/<slug>/check.json'],
  ['lighthouse', 'node engine/tools/lighthouse.mjs sites/<slug>/dist --out reports/<slug>/lighthouse'],
  ['uniquenessGate', 'node tools/uniqueness.mjs --post sites/<slug> --against registry --fail'],
  ['policyUrlsVerified', 'node tools/policy-recheck.mjs --initial <name> (Phase 4); every usedBy rule of the type verified'],
  ['hostingProject', 'node tools/cf.mjs project create <cfProject> (Phase 3)'],
  ['dns', 'node tools/probe.mjs <domain> --dns (Phase 2)'],
  ['searchConsole', 'owner: Search Console verification'],
];
const TYPE_GATE = {
  'social-casino': [['pragmaticDecision', '/pragmatic-verify <slug> or typeOptions.games.mode house'], ['audienceAssessmentSigned', '/order --assessment; signed orders/<slug>/audience-assessment.md'], ['adsCertification', 'owner: Google social casino certification per country']],
  'online-games': [['audienceAssessmentSigned', '/order --assessment; signed orders/<slug>/audience-assessment.md'], ['providerPaidSearchChecked', 'owner: publisher agreement clause permitting paid search'], ['distributorTerms', 'owner: distributor terms on file'], ['licenceScope', 'owner: game licence scope covers this domain']],
  'hotel-casino': [['affiliatePaidSearchChecked', 'owner: affiliate programme clause permitting paid search'], ['hotelFacts', 'owner: hotel facts sheet approved'], ['bookingClause', 'owner: booking engine / OTA terms'], ['modeConfirmation', 'Mode B only: Google written confirmation on file']],
};

function check(root) {
  const errors = [];
  const stages = loadStages(root);
  errors.push(...checkStages(stages));
  const board = readJsonIf(path.join(root, 'schemas', 'board.schema.json'));
  if (board) {
    let found = board.stages;
    if (!found) { const rec = (n, d) => { if (found || !n || typeof n !== 'object' || d > 8) return; if (Array.isArray(n.stages) && n.stages.every((s) => typeof s === 'string')) { found = n.stages; return; } for (const v of Object.values(n)) rec(v, d + 1); }; rec(board, 0); }
    if (!found) errors.push('schemas/board.schema.json: no stages list found');
    else if (JSON.stringify(found) !== JSON.stringify(stages.stages)) errors.push('schemas/board.schema.json: stages differ from schemas/stages.json');
  }
  const derivedStatuses = new Set(Object.values(stages.derive.orderStatus));
  for (const t of collectOrders(root, { templates: true, inFlight: false }).filter((o) => o.source === 'template')) {
    if (!derivedStatuses.has(t.order.status)) errors.push(`${t.file}: status "${t.order.status}" is not an order status of schemas/stages.json`);
  }
  const { rows, registry } = portfolio(root);
  for (const r of rows) {
    const where = r.order ? r.order.file : `sites/${r.slug}`;
    if (r.orderStatus && !derivedStatuses.has(r.orderStatus)) errors.push(`${where}: status "${r.orderStatus}" is not an order status of schemas/stages.json`);
    if (r.stage && !stages.stages.includes(r.stage)) { errors.push(`${r.stageFrom || 'board'} ${r.slug}: stage "${r.stage}" is not in schemas/stages.json`); continue; }
    if (!r.stage) continue;
    if (r.orderStatus) {
      const want = stages.derive.orderStatus[r.stage];
      const lag = (stages.orderStatusLag || {})[r.stage] || [];
      if (r.orderStatus !== want && !lag.includes(r.orderStatus)) errors.push(`${where}: status "${r.orderStatus}" disagrees with the Board stage "${r.stage}" (expected "${want}"${lag.length ? ` or ${lag.join('/')}` : ''})`);
    }
    if (r.registry && r.registry.status !== undefined && registry.source !== 'seed') {
      const want = stages.derive.registryStatus[r.stage];
      const ok = r.registry.status === want || (r.registry.status === 'reserved' && ['intake', 'questions-sent', 'proposal'].includes(r.stage));
      if (!ok) errors.push(`${registry.source} ${r.slug}: status "${r.registry.status}" disagrees with stage "${r.stage}" (expected "${want}")`);
      if (r.registry.stage && r.boardRow && r.boardRow.stage && r.registry.stage !== r.boardRow.stage) errors.push(`${registry.source} ${r.slug}: stage "${r.registry.stage}" differs from the Board stage "${r.boardRow.stage}"`);
    }
    const label = r.boardRow && r.boardRow.pr && Array.isArray(r.boardRow.pr.labels) ? r.boardRow.pr.labels.find((l) => /^stage:|^blocked$/.test(l)) : null;
    if (label) {
      const want = stages.derive.prLabel[r.stage];
      if (want && label !== want) errors.push(`reports/${r.slug}/board-row.json: PR label "${label}" disagrees with stage "${r.stage}" (expected "${want}")`);
    }
  }
  return { errors, checked: rows.length };
}

function gate(slug, root) {
  const { rows } = portfolio(root);
  const r = rows.find((x) => x.slug === slug);
  const ord = r && r.order ? r.order.order : null;
  const type = (r && r.type) || 'social-casino';
  const ticks = (ord && ord.launch && ord.launch.checklist) || {};
  const out = [];
  for (const [item, cmd] of [...GATE_ITEMS, ...(TYPE_GATE[type] || [])]) {
    const t = ticks[item];
    out.push([t ? (t.done ? 'done' : 'open') : 'missing', item, t && t.evidence ? t.evidence.slice(0, 60) : '', cmd.replace(/<slug>/g, slug).replace(/<domain>/g, (ord && ord.domain) || '<domain>')]);
  }
  return { slug, type, hasOrder: !!ord, rows: out };
}

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['table', 'json', 'mine', 'check', 'offline-ok', 'fingerprints', 'help'], strings: ['gate'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const root = repoRoot();
  if (a.check) {
    const r = check(root);
    if (a.json) process.stdout.write(`${JSON.stringify({ ok: r.errors.length === 0, ...r }, null, 2)}\n`);
    else {
      for (const e of r.errors) process.stdout.write(`error: ${e}\n`);
      process.stdout.write(`status --check: ${r.errors.length ? `${r.errors.length} problem(s)` : 'consistent'} (stages.json + ${r.checked} site/order record(s))\n`);
    }
    return r.errors.length ? 1 : 0;
  }
  if (a.gate) {
    const g = gate(a.gate, root);
    if (a.json) { process.stdout.write(`${JSON.stringify(g, null, 2)}\n`); return 0; }
    process.stdout.write(`launch gate for ${g.slug} (${g.type})${g.hasOrder ? '' : ': no order.json, every tick is missing'}\n`);
    process.stdout.write(`${table(g.rows, ['done', 'item', 'evidence', 'command'])}\n`);
    return 0;
  }
  if (a.fingerprints) throw new UsageError('--fingerprints needs tools/registry.mjs (Phase 2)');
  const { rows, registry } = portfolio(root);
  const mine = a.mine ? process.env.SITE_SLUG : null;
  const sel = rows.filter((r) => !mine || r.slug === mine);
  if (a.json) {
    process.stdout.write(`${JSON.stringify({ registry: registry.source, github: 'not queried', rows: sel.map(({ site, order, registry: reg, boardRow, build, uniqueness, check: chk, ...rest }) => ({ ...rest, build: build ? { version: build.version, problems: (build.problems || []).length, warnings: (build.warnings || []).length } : null, uniqueness: uniqueness ? { passed: uniqueness.passed, nearest: uniqueness.nearest } : null, check: chk ? chk.totals || null : null })) }, null, 2)}\n`);
    return 0;
  }
  const t = sel.map((r) => [
    r.slug, r.type || '?', r.stage || '-', r.orderStatus || '-', r.registryStatus || '-', r.engine,
    r.build ? `${(r.build.problems || []).length}p/${(r.build.warnings || []).length}w` : '-',
    r.check && r.check.totals ? `${r.check.totals.passed}/${r.check.totals.failed}` : '-',
    r.uniqueness ? (r.uniqueness.passed ? 'pass' : 'FAIL') : '-',
  ]);
  process.stdout.write(`${table(t, ['site', 'type', 'stage', 'order', 'registry', 'engine', 'build', 'check', 'uniq'])}\n`);
  process.stdout.write(`registry: ${registry.source}; GitHub: not queried (Phase 1)\n`);
  return 0;
}

if (isMain(import.meta.url)) runMain(main, HELP);
